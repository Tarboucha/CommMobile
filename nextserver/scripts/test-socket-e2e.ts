/**
 * End-to-end test for the socket-server (localhost:3001)
 *
 * Tests:
 *   1. Reject connection with invalid token
 *   2. Accept connection with valid JWT → receives `connected` event
 *   3. Room management (join/leave community, booking, conversation)
 *   4. Live message broadcast — insert message in DB → socket receives `message:new`
 *   5. Live notification broadcast — insert notification in DB → socket receives `notification:new`
 *   6. Clean disconnect
 *
 * Requires the Docker stack to be running (kodo-socket on localhost:3001, kodo-auth on localhost:3004).
 */

import './load-env'
import { io, Socket } from 'socket.io-client'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const SOCKET_URL = 'http://localhost:3001'
const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3004'
const PROVIDER_EMAIL = 'test3@kodo.com'
const CUSTOMER_EMAIL = 'test2@kodo.com'
const PASSWORD = 'test123'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function section(title: string) {
  console.log(`\n${'─'.repeat(70)}\n${title}\n${'─'.repeat(70)}`)
}

function ok(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never {
  console.log(`  ✗ ${msg}`)
  throw new Error(msg)
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(msg)
  else ok(msg)
}

async function login(email: string): Promise<{ token: string; profileId: string }> {
  const res = await fetch(`${AUTH_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Login failed for ${email}: ${data.message}`)

  const profile = await prisma.profiles.findFirstOrThrow({ where: { email } })
  return { token: data.access_token, profileId: profile.id }
}

function connect(token: string, profileId: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      auth: { token, profileId },
      transports: ['websocket'],
      timeout: 5000,
    })
    socket.once('connected', () => resolve(socket))
    socket.once('connect_error', (err) => reject(err))
  })
}

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${event}'`)), timeoutMs)
    socket.once(event, (data: T) => {
      clearTimeout(timer)
      resolve(data)
    })
  })
}

function disconnect(socket: Socket): Promise<void> {
  return new Promise((resolve) => {
    socket.once('disconnect', () => resolve())
    socket.disconnect()
  })
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {

  // ── 1. Login ──────────────────────────────────────────────────────────────
  section('1. Login via auth-service')
  const provider = await login(PROVIDER_EMAIL)
  const customer = await login(CUSTOMER_EMAIL)
  ok(`provider: ${PROVIDER_EMAIL} (${provider.profileId})`)
  ok(`customer: ${CUSTOMER_EMAIL} (${customer.profileId})`)

  // ── 2. Reject invalid token ───────────────────────────────────────────────
  section('2. Reject connection with invalid token')
  await new Promise<void>((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      auth: { token: 'not-a-real-token', profileId: provider.profileId },
      transports: ['websocket'],
      timeout: 5000,
    })
    socket.once('connect_error', (err) => {
      ok(`Connection correctly refused: ${err.message}`)
      socket.disconnect()
      resolve()
    })
    socket.once('connected', () => {
      socket.disconnect()
      reject(new Error('Should have been rejected but connected'))
    })
  })

  // ── 3. Reject profile ID mismatch ─────────────────────────────────────────
  section('3. Reject token/profileId mismatch')
  await new Promise<void>((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      auth: { token: provider.token, profileId: customer.profileId }, // wrong profileId
      transports: ['websocket'],
      timeout: 5000,
    })
    socket.once('connect_error', (err) => {
      ok(`Mismatch correctly refused: ${err.message}`)
      socket.disconnect()
      resolve()
    })
    socket.once('connected', () => {
      socket.disconnect()
      reject(new Error('Should have been rejected but connected'))
    })
  })

  // ── 4. Accept valid connection ────────────────────────────────────────────
  section('4. Accept valid connection')
  const providerSocket = await connect(provider.token, provider.profileId)
  ok(`provider socket connected: ${providerSocket.id}`)

  const customerSocket = await connect(customer.token, customer.profileId)
  ok(`customer socket connected: ${customerSocket.id}`)

  // ── 5. Room management ────────────────────────────────────────────────────
  section('5. Room management (join/leave events)')

  const community = await prisma.community_members.findFirstOrThrow({
    where: { profile_id: provider.profileId },
  })
  const communityId = community.community_id

  providerSocket.emit('join:community', communityId)
  ok(`join:community emitted (${communityId})`)

  providerSocket.emit('leave:community', communityId)
  ok('leave:community emitted')

  providerSocket.emit('join:booking', 'test-booking-id')
  ok('join:booking emitted')
  providerSocket.emit('leave:booking', 'test-booking-id')
  ok('leave:booking emitted')

  providerSocket.emit('join:conversation', 'test-conv-id')
  ok('join:conversation emitted')
  providerSocket.emit('leave:conversation', 'test-conv-id')
  ok('leave:conversation emitted')

  // ── 6. Live message broadcast ─────────────────────────────────────────────
  section('6. Live message broadcast (pg_notify → socket)')

  // Find or create a conversation both users are in
  const conversation = await prisma.conversations.findFirst({
    where: {
      conversation_type: 'direct',
      conversation_participants: {
        some: { profile_id: provider.profileId },
      },
    },
    include: { conversation_participants: true },
  })

  if (!conversation) fail('No direct conversation found — run booking e2e first')

  // Both clients join the conversation room
  providerSocket.emit('join:conversation', conversation.id)
  customerSocket.emit('join:conversation', conversation.id)

  // Wait briefly for room joins to propagate
  await new Promise(r => setTimeout(r, 300))

  // Listen for the broadcast on customer socket
  const messagePromise = waitForEvent<any>(customerSocket, 'message:new', 5000)

  // Insert a message directly — this fires the pg_notify trigger
  await prisma.messages.create({
    data: {
      conversation_id: conversation.id,
      sender_id: provider.profileId,
      content: '[socket-e2e-test] hello',
      message_type: 'text',
    },
  })
  ok('message inserted into DB')

  const receivedMsg = await messagePromise
  ok(`customer received message:new event`)
  assert(receivedMsg.conversation_id === conversation.id, 'conversation_id matches')
  assert(receivedMsg.sender_id === provider.profileId, 'sender_id matches')
  assert(receivedMsg.content === '[socket-e2e-test] hello', 'content matches')

  // ── 7. Live notification broadcast ────────────────────────────────────────
  section('7. Live notification broadcast (pg_notify → socket)')

  const notifPromise = waitForEvent<any>(customerSocket, 'notification:new', 5000)

  // Insert a notification for customer — triggers pg_notify
  await prisma.notifications.create({
    data: {
      profile_id: customer.profileId,
      notification_type: 'system',
      title: 'Socket e2e test',
      body: 'This is a test notification',
      is_read: false,
    },
  })
  ok('notification inserted into DB')

  const receivedNotif = await notifPromise
  ok('customer received notification:new event')
  assert(receivedNotif.type === 'system', 'notification type matches')
  assert(receivedNotif.title === 'Socket e2e test', 'notification title matches')

  // ── 8. Clean disconnect ───────────────────────────────────────────────────
  section('8. Clean disconnect')
  await disconnect(providerSocket)
  ok('provider disconnected cleanly')
  await disconnect(customerSocket)
  ok('customer disconnected cleanly')

  // ── 9. Cleanup ────────────────────────────────────────────────────────────
  section('9. Cleanup')
  await prisma.messages.deleteMany({
    where: { content: '[socket-e2e-test] hello' },
  })
  await prisma.notifications.deleteMany({
    where: { title: 'Socket e2e test', profile_id: customer.profileId },
  })
  ok('test data removed')

  console.log('\n' + '═'.repeat(68))
  console.log('  ALL SOCKET CHECKS PASSED')
  console.log('═'.repeat(68))
}

main()
  .catch((err) => {
    console.error('\n✗ TEST FAILED:', err.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

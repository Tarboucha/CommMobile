# Community Chat — WebSocket Flow

Complete flow of the real-time community chat system, from server startup to message delivery.

---

## 1. Server Startup

When `custom-server.ts` runs, it initializes three things in order:

```
custom-server.ts
│
├─ 1. Socket.io Server (io)
│     Attaches to the HTTP server, applies auth middleware
│
├─ 2. PgNotifyManager (pgManager)
│     Created with a reference to `io`
│     │
│     └─ registerListeners(pgManager)
│           Calls pgManager.registerChannel() for each channel:
│           │
│           │  handlers Map after registration:
│           │  ┌──────────────────────┬─────────────────────────┐
│           │  │ Channel              │ Handler                 │
│           │  ├──────────────────────┼─────────────────────────┤
│           │  │ 'notification_created'│ notificationListener   │
│           │  │ 'message_created'    │ chatListener            │
│           │  └──────────────────────┴─────────────────────────┘
│           │
│           └─ pgManager.connect()
│                Opens a dedicated pg.Client connection
│                Runs: LISTEN notification_created
│                Runs: LISTEN message_created
│                Now PostgreSQL knows to send NOTIFY events to this connection
│
└─ 3. HTTP Server starts on port 3002
```

**Files involved:**
- `nextserver/custom-server.ts` — orchestrates everything
- `nextserver/src/lib/pg-notify/pg-notify-manager.ts` — manages the PG LISTEN connection
- `nextserver/src/lib/pg-notify/listeners/index.ts` — registers all channel→handler mappings
- `nextserver/src/lib/pg-notify/listeners/chat-listener.ts` — the chat handler
- `nextserver/src/lib/pg-notify/listeners/notification-listener.ts` — the notification handler

---

## 2. Mobile App Connects

When the user logs in, `SocketProvider` creates a Socket.io connection:

```
Mobile App (SocketProvider)
│
├─ Gets Supabase JWT access_token
│
├─ Connects: io('http://server:3002', {
│    auth: { token: accessToken, profileId: user.id }
│  })
│
▼
Server (custom-server.ts)
│
├─ io.use(authenticateSocket)
│    │  Verifies JWT with Supabase
│    │  Extracts user ID from token
│    │  Checks profileId matches token
│    └─ Attaches userId to socket → AuthenticatedSocket
│
├─ io.on('connection', socket => { ... })
│    │
│    ├─ Auto-joins room: user:{userId}        ← for notifications
│    │
│    ├─ Registers listener: join:community    ← chat room join
│    ├─ Registers listener: leave:community   ← chat room leave
│    └─ Registers listener: disconnect        ← cleanup
│
▼
Socket is connected, authenticated, and in user:{userId} room
The socket is NOT in any community room yet — that happens in step 3
```

**Files involved:**
- `nativeCom/src/contexts/socket-context.tsx` — SocketProvider, manages connection lifecycle
- `nextserver/src/lib/socket/auth.ts` — authenticateSocket middleware
- `nextserver/custom-server.ts` — connection handler (lines 48-88)

---

## 3. User Opens Community Chat Tab

When the user navigates to a community and the Chat tab mounts:

```
ChatTab component mounts
│
├─ 1. REST: getCommunityConversation(communityId)
│       GET /api/communities/{communityId}/conversation
│       → Server checks membership, returns conversation row
│       → ChatTab stores conversationId in state
│
├─ 2. REST: getMessages(communityId, 30)
│       GET /api/communities/{communityId}/conversation/messages?limit=30
│       → Server returns 30 newest messages with sender profiles
│       → ChatTab renders them in an inverted FlatList
│
├─ 3. Socket.io: socket.emit('join:community', communityId)
│       │
│       ▼ Server receives this event
│       authSocket.on('join:community', (communityId) => {
│         authSocket.join(`community:${communityId}`)
│       })
│       │
│       ▼ Socket is now in room: community:{communityId}
│
└─ 4. Socket.io: socket.on('message:new', handleNewMessage)
        ChatTab starts listening for incoming messages on this event
```

When the user leaves the Chat tab (unmount):

```
ChatTab cleanup runs
│
├─ socket.off('message:new', handleNewMessage)  ← stop listening
└─ socket.emit('leave:community', communityId)  ← leave room
```

**Files involved:**
- `nativeCom/src/components/pages/community/chat-tab.tsx` — ChatTab UI (lines 115-165)
- `nativeCom/src/lib/api/chat.ts` — REST API functions
- `nextserver/src/app/api/communities/[communityId]/conversation/route.ts` — GET conversation
- `nextserver/src/app/api/communities/[communityId]/conversation/messages/route.ts` — GET/POST messages

---

## 4. Sending a Message

```
User types "Hello!" and taps Send
│
▼
ChatTab.handleSend()
│
├─ Clears input, sets isSending=true
│
├─ REST: sendMessage(communityId, "Hello!")
│       POST /api/communities/{communityId}/conversation/messages
│       Body: { content: "Hello!" }
│       │
│       ▼ Server (messages/route.ts POST handler)
│       │
│       ├─ withAuth: verifies JWT, gets user.id
│       ├─ Checks user is active community member
│       ├─ Gets conversation ID for this community
│       ├─ Validates body with Zod (content: 1-5000 chars)
│       │
│       ├─ INSERT into messages table:
│       │    { conversation_id, sender_id: user.id, content: "Hello!" }
│       │
│       │   ══════════════════════════════════════════════════
│       │   This INSERT triggers the PostgreSQL flow (step 5)
│       │   ══════════════════════════════════════════════════
│       │
│       ├─ SELECT the inserted message with sender profile join
│       └─ Returns: { message: ChatMessage } with status 201
│
├─ ChatTab receives the REST response
│  Adds message to state (deduplicates if socket already delivered it)
│
└─ Sets isSending=false
```

**Files involved:**
- `nativeCom/src/components/pages/community/chat-tab.tsx` — handleSend (lines 183-204)
- `nativeCom/src/lib/api/chat.ts` — sendMessage function
- `nextserver/src/app/api/communities/[communityId]/conversation/messages/route.ts` — POST handler
- `nextserver/src/lib/validations/message.ts` — sendMessageSchema

---

## 5. PostgreSQL NOTIFY → Server → Socket.io Broadcast

This is the core real-time pipeline. It starts when the INSERT from step 4 hits the database:

```
PostgreSQL
│
├─ INSERT into messages completes
│
├─ AFTER INSERT trigger fires: notify_on_message_insert
│       │
│       ▼ Calls function: notify_new_message()
│       │
│       ├─ SELECT conversation_type, community_id, booking_id
│       │  FROM conversations WHERE id = NEW.conversation_id
│       │
│       └─ pg_notify('message_created', '{
│            "message_id": "uuid-...",
│            "conversation_id": "uuid-...",
│            "conversation_type": "community",
│            "community_id": "uuid-...",
│            "booking_id": null,
│            "sender_id": "uuid-...",
│            "content": "Hello!",
│            "created_at": "2026-02-13T..."
│          }')
│
│          Note: content is truncated to 7000 chars (pg_notify has 8KB limit)
│
▼
PgNotifyManager (listening on a dedicated pg.Client connection)
│
├─ client.on('notification', (msg) => { ... })
│    msg.channel = 'message_created'
│    msg.payload = '{"message_id": "...", ...}'
│
├─ const handler = this.handlers.get('message_created')
│    → returns chatListener
│
├─ const payload = JSON.parse(msg.payload)
│
└─ handler(payload, this.io)     ← calls chatListener with parsed payload + io server
     │
     ▼
     chatListener (chat-listener.ts)
     │
     ├─ Reads payload.conversation_type → 'community'
     │
     ├─ switch: case 'community' → room = `community:${payload.community_id}`
     │          case 'booking'   → room = `booking:${payload.booking_id}`
     │          case 'direct'    → room = `conversation:${payload.conversation_id}`
     │
     └─ io.to('community:abc-123').emit('message:new', {
            message_id, conversation_id, conversation_type,
            community_id, booking_id, sender_id, content, created_at
          })
          │
          ▼
          Socket.io delivers to ALL sockets in room community:abc-123
```

**Files involved:**
- `docs/newdb/chat-notify-trigger.sql` — SQL trigger + function
- `nextserver/src/lib/pg-notify/pg-notify-manager.ts` — routes NOTIFY to handler (lines 70-89)
- `nextserver/src/lib/pg-notify/listeners/chat-listener.ts` — broadcasts to Socket.io room

---

## 6. Mobile Receives the Message

```
Socket.io delivers 'message:new' event to all clients in the room
│
▼
ChatTab (any user who has this community's Chat tab open)
│
├─ socket.on('message:new', handleNewMessage)
│
├─ handleNewMessage receives:
│    { message_id, conversation_id, sender_id, content, created_at, ... }
│
├─ Checks: data.conversation_id === conversationId (skip if wrong conversation)
│
├─ Builds a ChatMessage object from the socket payload
│    (sender profile is minimal — just sender_id, no display_name yet)
│
├─ setMessages(prev => {
│     if (prev.some(m => m.id === data.message_id)) return prev  ← dedup
│     return [newMessage, ...prev]                                ← prepend
│   })
│
└─ FlatList (inverted) renders new message at the bottom of the screen
```

**Deduplication:** The sender gets the message from TWO sources:
1. The REST response from `sendMessage()` (step 4)
2. The Socket.io broadcast (step 5-6, because they're also in the room)

The `prev.some(m => m.id === data.message_id)` check prevents showing the message twice.

**Files involved:**
- `nativeCom/src/components/pages/community/chat-tab.tsx` — handleNewMessage (lines 120-157)

---

## 7. Loading Older Messages (Pagination)

When the user scrolls up to load history:

```
FlatList.onEndReached triggers (inverted, so "end" = top = older messages)
│
├─ loadMore() called
│
├─ REST: getMessages(communityId, 30, nextCursor)
│       GET /api/communities/{communityId}/conversation/messages?limit=30&after={cursor}
│       │
│       ▼ Server applies cursor-based pagination
│       Ordered by created_at DESC, filtered by cursor
│       Includes sender profile join
│
├─ Appends older messages to end of list
└─ Updates nextCursor for next page
```

---

## Complete Flow Diagram

```
 MOBILE APP                           SERVER                              POSTGRESQL
 ══════════                           ══════                              ══════════

 ┌──────────────┐                     ┌──────────────────┐
 │ SocketProvider│──── WS connect ───►│ Socket.io Server  │
 │ (on login)    │     auth: {token}  │ authenticateSocket│
 │               │◄── 'connected' ────│ join user:{id}    │
 └──────────────┘                     └──────────────────┘

 ┌──────────────┐                     ┌──────────────────┐
 │ ChatTab mount │── GET /conversation►│ REST API          │
 │               │◄── conversation ────│                   │
 │               │── GET /messages ───►│                   │
 │               │◄── messages[] ──────│                   │
 └──────────────┘                     └──────────────────┘
                                      ┌──────────────────┐
 ┌──────────────┐                     │                  │
 │ ChatTab mount │── join:community ─►│ Socket.io Server  │
 │               │   (communityId)    │ socket.join(room) │
 └──────────────┘                     └──────────────────┘

 ┌──────────────┐                     ┌──────────────────┐                ┌─────────────┐
 │ User sends   │── POST /messages ──►│ REST API          │── INSERT ────►│ messages    │
 │ "Hello!"     │◄── { message } ─────│ validates + insert│               │ table        │
 └──────────────┘                     └──────────────────┘                │              │
                                                                          │ TRIGGER fires│
                                                                          │ pg_notify()  │
                                      ┌──────────────────┐                │              │
                                      │ PgNotifyManager   │◄── NOTIFY ───│              │
                                      │ handlers.get()    │               └─────────────┘
                                      │ → chatListener    │
                                      └────────┬─────────┘
                                               │
                                      ┌────────▼─────────┐
                                      │ chatListener      │
                                      │ io.to(room).emit  │
                                      │ 'message:new'     │
                                      └────────┬─────────┘
                                               │
 ┌──────────────┐                              │
 │ All clients  │◄──── 'message:new' ──────────┘
 │ in room      │
 │ update UI    │
 └──────────────┘
```

---

## File Reference

| Layer | File | Role |
|-------|------|------|
| SQL | `docs/newdb/chat-notify-trigger.sql` | AFTER INSERT trigger on messages → pg_notify |
| SQL | `docs/newdb/community-conversation-triggers.sql` | Auto-create conversation on community creation |
| Server | `nextserver/custom-server.ts` | Orchestrates io + pgManager + room handlers |
| Server | `nextserver/src/lib/pg-notify/pg-notify-manager.ts` | LISTEN connection, routes NOTIFY → handlers |
| Server | `nextserver/src/lib/pg-notify/listeners/index.ts` | Registers all channel→handler mappings |
| Server | `nextserver/src/lib/pg-notify/listeners/chat-listener.ts` | Broadcasts message to Socket.io room |
| Server | `nextserver/src/lib/socket/auth.ts` | JWT verification middleware |
| Server | `nextserver/src/types/socket.ts` | Event types + payload interfaces |
| Server | `nextserver/src/lib/validations/message.ts` | Zod schemas for message input |
| Server | `nextserver/src/app/api/.../conversation/route.ts` | GET community conversation |
| Server | `nextserver/src/app/api/.../conversation/messages/route.ts` | GET messages + POST send |
| Mobile | `nativeCom/src/contexts/socket-context.tsx` | SocketProvider, connection lifecycle |
| Mobile | `nativeCom/src/lib/api/chat.ts` | REST functions (getConversation, getMessages, sendMessage) |
| Mobile | `nativeCom/src/types/chat.ts` | ChatMessage, Conversation, MessageSender types |
| Mobile | `nativeCom/src/components/pages/community/chat-tab.tsx` | Chat UI, room join/leave, real-time listener |

---

## Room Types

| Room Pattern | When Joined | Used For |
|---|---|---|
| `user:{profileId}` | Automatically on socket connection | Notifications, badge updates |
| `community:{communityId}` | When ChatTab mounts | Community group chat messages |
| `conversation:{conversationId}` | (future) When DM chat opens | Direct messages |
| `booking:{bookingId}` | (future) When booking chat opens | Booking-related messages |

---

## Design Decisions

**REST for writes, WebSocket for delivery** — Same pattern as Slack. REST gives us HTTP status codes, Zod validation, withAuth middleware, and guaranteed persistence. WebSocket gives us instant push delivery.

**pg_notify instead of Supabase Realtime** — We control the pipeline. pg_notify → PgNotifyManager → chat-listener → Socket.io. No third-party dependency for real-time delivery.

**Content in the NOTIFY payload** — The full message content travels through the WebSocket (truncated to 7000 chars for pg_notify's 8KB limit). This avoids a second REST call on the receiving client to fetch the message content.

**Deduplication by message_id** — The sender receives the message twice (REST response + socket broadcast). The `prev.some(m => m.id === message_id)` check prevents duplicates.

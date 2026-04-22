import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { pool } from '../db.js'
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
} from '../jwt.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../email.js'

const BCRYPT_ROUNDS = 10
const VERIFICATION_RESEND_COOLDOWN_SECONDS = parseInt(
  process.env.VERIFICATION_RESEND_COOLDOWN_SECONDS || '300',
  10,
)

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

/**
 * Consume an email-verification token: mark the user as verified and the
 * token as used. Returns ok=false when the token is missing, expired, or
 * already consumed — callers should treat all three as "invalid link".
 */
async function consumeVerificationToken(token: string): Promise<{ ok: boolean }> {
  const { rows } = await pool.query(
    `SELECT id, user_id FROM auth.email_verifications
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()`,
    [token],
  )
  if (rows.length === 0) return { ok: false }

  const { id: verificationId, user_id } = rows[0]
  await pool.query('UPDATE auth.users SET email_verified = true WHERE id = $1', [user_id])
  await pool.query(
    'UPDATE auth.email_verifications SET used_at = now() WHERE id = $1',
    [verificationId],
  )
  return { ok: true }
}

function verifyResultPage(reply: any, status: number, title: string, body: string) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — KoDo</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         max-width: 480px; margin: 4rem auto; padding: 1.5rem; color: #222;
         background: #fafafa; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  p  { line-height: 1.5; color: #444; }
</style>
</head>
<body>
  <h1>${title}</h1>
  <p>${body}</p>
</body>
</html>`
  return reply.status(status).type('text/html; charset=utf-8').send(html)
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function authRoutes(fastify: FastifyInstance) {

  // ── POST /auth/register ───────────────────────────────────────────────────
  fastify.post<{ Body: { email: string; password: string } }>(
    '/auth/register',
    async (req, reply) => {
      const { email, password } = req.body

      if (!email || !password) {
        return reply.status(400).send({ message: 'Email and password are required' })
      }
      if (password.length < 6) {
        return reply.status(400).send({ message: 'Password must be at least 6 characters' })
      }

      // Check if email exists
      const { rows: existing } = await pool.query(
        'SELECT id FROM auth.users WHERE email = $1',
        [email.toLowerCase().trim()]
      )
      if (existing.length > 0) {
        return reply.status(409).send({ message: 'Email already registered' })
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

      const { rows } = await pool.query(
        `INSERT INTO auth.users (email, password_hash) VALUES ($1, $2) RETURNING id`,
        [email.toLowerCase().trim(), passwordHash]
      )
      const userId = rows[0].id

      // Create email verification token
      const token = randomBytes(32).toString('hex')
      await pool.query(
        `INSERT INTO auth.email_verifications (user_id, token, expires_at)
         VALUES ($1, $2, now() + interval '24 hours')`,
        [userId, token]
      )

      // Also create a matching public.profiles row
      await pool.query(
        `INSERT INTO public.profiles (id, email, auth_user_id) VALUES ($1, $2, $1)`,
        [userId, email.toLowerCase().trim()]
      )

      try {
        await sendVerificationEmail(email, token)
      } catch (err) {
        req.log.error({ err, userId, email }, 'failed to send verification email')
      }

      return reply.status(201).send({ message: 'Account created. Check your email to verify.' })
    }
  )

  // ── POST /auth/login ──────────────────────────────────────────────────────
  fastify.post<{ Body: { email: string; password: string } }>(
    '/auth/login',
    async (req, reply) => {
      const { email, password } = req.body

      if (!email || !password) {
        return reply.status(400).send({ message: 'Email and password are required' })
      }

      const { rows } = await pool.query(
        'SELECT id, email, password_hash, email_verified FROM auth.users WHERE email = $1',
        [email.toLowerCase().trim()]
      )
      if (rows.length === 0) {
        return reply.status(401).send({ message: 'Invalid email or password' })
      }

      const user = rows[0]
      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) {
        return reply.status(401).send({ message: 'Invalid email or password' })
      }

      if (!user.email_verified) {
        return reply.status(403).send({
          message: 'Please verify your email before signing in',
          code: 'email_not_verified',
          email: user.email,
        })
      }

      // Sign access token — sub = user.id = profile ID
      const accessToken = await signAccessToken({
        sub: user.id,
        email: user.email,
        role: 'authenticated',
      })

      // Create refresh token
      const refreshToken = generateRefreshToken()
      await pool.query(
        `INSERT INTO auth.refresh_tokens (user_id, token, expires_at)
         VALUES ($1, $2, now() + $3 * interval '1 second')`,
        [user.id, refreshToken, REFRESH_TOKEN_TTL]
      )

      return reply.send({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: ACCESS_TOKEN_TTL,
        token_type: 'Bearer',
      })
    }
  )

  // ── POST /auth/refresh ────────────────────────────────────────────────────
  fastify.post<{ Body: { refresh_token: string } }>(
    '/auth/refresh',
    async (req, reply) => {
      const { refresh_token } = req.body

      if (!refresh_token) {
        return reply.status(400).send({ message: 'refresh_token is required' })
      }

      // Find active (non-revoked, non-expired) refresh token
      const { rows } = await pool.query(
        `SELECT rt.id, rt.user_id, u.email
         FROM auth.refresh_tokens rt
         JOIN auth.users u ON u.id = rt.user_id
         WHERE rt.token = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now()`,
        [refresh_token]
      )

      if (rows.length === 0) {
        return reply.status(401).send({ message: 'Invalid or expired refresh token' })
      }

      const { id: oldTokenId, user_id, email } = rows[0]

      // Rotate: revoke old token and issue new pair
      await pool.query(
        'UPDATE auth.refresh_tokens SET revoked_at = now() WHERE id = $1',
        [oldTokenId]
      )

      const newAccessToken = await signAccessToken({
        sub: user_id,
        email,
        role: 'authenticated',
      })

      const newRefreshToken = generateRefreshToken()
      await pool.query(
        `INSERT INTO auth.refresh_tokens (user_id, token, expires_at)
         VALUES ($1, $2, now() + $3 * interval '1 second')`,
        [user_id, newRefreshToken, REFRESH_TOKEN_TTL]
      )

      return reply.send({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_in: ACCESS_TOKEN_TTL,
        token_type: 'Bearer',
      })
    }
  )

  // ── POST /auth/logout ─────────────────────────────────────────────────────
  fastify.post('/auth/logout', async (req, reply) => {
    const token = extractBearerToken(req.headers.authorization)
    if (!token) {
      return reply.status(401).send({ message: 'Bearer token required' })
    }

    let claims
    try {
      claims = await verifyAccessToken(token)
    } catch {
      return reply.status(401).send({ message: 'Invalid token' })
    }

    // Revoke all active refresh tokens for this user
    await pool.query(
      'UPDATE auth.refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [claims.sub]
    )

    return reply.send({ message: 'Logged out' })
  })

  // ── GET /auth/user ────────────────────────────────────────────────────────
  fastify.get('/auth/user', async (req, reply) => {
    const token = extractBearerToken(req.headers.authorization)
    if (!token) {
      return reply.status(401).send({ message: 'Bearer token required' })
    }

    let claims
    try {
      claims = await verifyAccessToken(token)
    } catch {
      return reply.status(401).send({ message: 'Invalid token' })
    }

    const { rows } = await pool.query(
      'SELECT id, email, email_verified, created_at FROM auth.users WHERE id = $1',
      [claims.sub]
    )

    if (rows.length === 0) {
      return reply.status(404).send({ message: 'User not found' })
    }

    return reply.send(rows[0])
  })

  // ── POST /auth/verify-email ───────────────────────────────────────────────
  // For programmatic callers (mobile app, tests). Returns JSON.
  fastify.post<{ Body: { token: string } }>(
    '/auth/verify-email',
    async (req, reply) => {
      const { token } = req.body
      if (!token) {
        return reply.status(400).send({ message: 'Token is required' })
      }

      const result = await consumeVerificationToken(token)
      if (!result.ok) {
        return reply.status(400).send({ message: 'Invalid or expired verification token' })
      }

      return reply.send({ message: 'Email verified' })
    }
  )

  // ── GET /auth/verify-email?token=... ──────────────────────────────────────
  // The URL embedded in the verification email — clicked from a browser.
  // Returns a minimal HTML page so the user sees a clear success/failure.
  fastify.get<{ Querystring: { token?: string } }>(
    '/auth/verify-email',
    async (req, reply) => {
      const token = req.query.token
      if (!token) {
        return verifyResultPage(reply, 400, 'Missing token',
          'This link is incomplete. Open the email again and click the full link.')
      }

      const result = await consumeVerificationToken(token)
      if (!result.ok) {
        return verifyResultPage(reply, 400, 'Link expired or invalid',
          'Request a new verification email from the KoDo app.')
      }

      return verifyResultPage(reply, 200, 'Email verified',
        'You can now sign in to the KoDo app.')
    }
  )

  // ── POST /auth/resend-verification ────────────────────────────────────────
  // Re-issue a verification email. Always returns 200 so we don't leak
  // whether an account exists or has already been verified. A DB-level
  // cooldown (VERIFICATION_RESEND_COOLDOWN_SECONDS, default 5min) prevents
  // triggering multiple emails when a user taps "resend" repeatedly.
  fastify.post<{ Body: { email: string } }>(
    '/auth/resend-verification',
    async (req, reply) => {
      const { email } = req.body
      if (!email) {
        return reply.status(400).send({ message: 'Email is required' })
      }

      const normalizedEmail = email.toLowerCase().trim()
      const { rows } = await pool.query(
        'SELECT id, email_verified FROM auth.users WHERE email = $1',
        [normalizedEmail],
      )

      if (rows.length > 0 && !rows[0].email_verified) {
        const userId = rows[0].id

        const { rows: recent } = await pool.query(
          `SELECT 1 FROM auth.email_verifications
           WHERE user_id = $1 AND created_at > now() - ($2 || ' seconds')::interval
           LIMIT 1`,
          [userId, VERIFICATION_RESEND_COOLDOWN_SECONDS],
        )

        if (recent.length === 0) {
          const token = randomBytes(32).toString('hex')
          await pool.query(
            `INSERT INTO auth.email_verifications (user_id, token, expires_at)
             VALUES ($1, $2, now() + interval '24 hours')`,
            [userId, token],
          )
          try {
            await sendVerificationEmail(normalizedEmail, token)
          } catch (err) {
            req.log.error({ err, email: normalizedEmail }, 'failed to resend verification email')
          }
        }
      }

      return reply.send({
        message: 'If that account needs verification, a link has been sent',
      })
    }
  )

  // ── POST /auth/forgot-password ────────────────────────────────────────────
  fastify.post<{ Body: { email: string } }>(
    '/auth/forgot-password',
    async (req, reply) => {
      const { email } = req.body
      if (!email) {
        return reply.status(400).send({ message: 'Email is required' })
      }

      // Always return 200 (don't reveal if email exists)
      const { rows } = await pool.query(
        'SELECT id FROM auth.users WHERE email = $1',
        [email.toLowerCase().trim()]
      )

      if (rows.length > 0) {
        const token = randomBytes(32).toString('hex')
        await pool.query(
          `INSERT INTO auth.password_resets (user_id, token, expires_at)
           VALUES ($1, $2, now() + interval '1 hour')`,
          [rows[0].id, token]
        )
        try {
          await sendPasswordResetEmail(email, token)
        } catch (err) {
          req.log.error({ err, email }, 'failed to send password reset email')
        }
      }

      return reply.send({ message: 'If that email exists, a reset link has been sent' })
    }
  )

  // ── POST /auth/reset-password ─────────────────────────────────────────────
  fastify.post<{ Body: { token: string; password: string } }>(
    '/auth/reset-password',
    async (req, reply) => {
      const { token, password } = req.body

      if (!token || !password) {
        return reply.status(400).send({ message: 'Token and password are required' })
      }
      if (password.length < 6) {
        return reply.status(400).send({ message: 'Password must be at least 6 characters' })
      }

      const { rows } = await pool.query(
        `SELECT pr.id, pr.user_id FROM auth.password_resets pr
         WHERE pr.token = $1 AND pr.used_at IS NULL AND pr.expires_at > now()`,
        [token]
      )

      if (rows.length === 0) {
        return reply.status(400).send({ message: 'Invalid or expired reset token' })
      }

      const { id: resetId, user_id } = rows[0]
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

      await pool.query('UPDATE auth.users SET password_hash = $1 WHERE id = $2', [passwordHash, user_id])
      await pool.query('UPDATE auth.password_resets SET used_at = now() WHERE id = $1', [resetId])

      // Revoke all refresh tokens (force re-login)
      await pool.query(
        'UPDATE auth.refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [user_id]
      )

      return reply.send({ message: 'Password updated' })
    }
  )

  // ── POST /auth/change-password ────────────────────────────────────────────
  fastify.post<{ Body: { current_password: string; new_password: string } }>(
    '/auth/change-password',
    async (req, reply) => {
      const token = extractBearerToken(req.headers.authorization)
      if (!token) {
        return reply.status(401).send({ message: 'Bearer token required' })
      }

      let claims
      try {
        claims = await verifyAccessToken(token)
      } catch {
        return reply.status(401).send({ message: 'Invalid token' })
      }

      const { current_password, new_password } = req.body
      if (!current_password || !new_password) {
        return reply.status(400).send({ message: 'Current password and new password are required' })
      }
      if (new_password.length < 6) {
        return reply.status(400).send({ message: 'New password must be at least 6 characters' })
      }

      const { rows } = await pool.query(
        'SELECT id, password_hash FROM auth.users WHERE id = $1',
        [claims.sub]
      )
      if (rows.length === 0) {
        return reply.status(404).send({ message: 'User not found' })
      }

      const valid = await bcrypt.compare(current_password, rows[0].password_hash)
      if (!valid) {
        return reply.status(401).send({ message: 'Current password is incorrect' })
      }

      const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS)
      await pool.query('UPDATE auth.users SET password_hash = $1 WHERE id = $2', [newHash, claims.sub])

      // Revoke all refresh tokens (force re-login on other devices)
      await pool.query(
        'UPDATE auth.refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [claims.sub]
      )

      return reply.send({ message: 'Password updated' })
    }
  )
}

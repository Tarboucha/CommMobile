import { Resend } from 'resend'
import { log } from './log'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is required')
}

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.MAIL_FROM || 'KoDo <noreply@comchefs.cloud>'
const APP_URL = process.env.APP_URL || 'https://api.comchefs.cloud'

const mailLog = log.child({ component: 'mail' })

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${APP_URL}/auth/verify-email?token=${token}`

  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Verify your KoDo email',
    html: `
      <h2>Welcome to KoDo!</h2>
      <p>Click the link below to verify your email address:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  })

  if (error) {
    mailLog.error({ err: error, to: email, kind: 'verification' }, 'send failed')
    throw new Error(`Failed to send verification email: ${error.message}`)
  }
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`

  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Reset your KoDo password',
    html: `
      <h2>Password reset request</h2>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, ignore this email.</p>
    `,
  })

  if (error) {
    mailLog.error({ err: error, to: email, kind: 'password-reset' }, 'send failed')
    throw new Error(`Failed to send password reset email: ${error.message}`)
  }
}

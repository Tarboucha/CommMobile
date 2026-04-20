import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
})

const FROM = process.env.SMTP_FROM || 'noreply@comchefs.cloud'

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${process.env.APP_URL || 'https://api.comchefs.cloud'}/verify-email?token=${token}`

  await transporter.sendMail({
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
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${process.env.APP_URL || 'https://api.comchefs.cloud'}/reset-password?token=${token}`

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Reset your KoDo password',
    html: `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `,
  })
}

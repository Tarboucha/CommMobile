import { z } from "zod"

// Login validation schema (simple)
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})
export type LoginInput = z.infer<typeof loginSchema>

// Signup validation schema (Simple)
export const signupSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((s) => s.trim().toLowerCase()),

  // keep a sensible minimum length for passwords, remove the complex regex here
  password: z.string().min(6, "Password must be at least 6 characters"),

  // keep simple presence + reasonable max length, trim whitespace
  firstName: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters").trim(),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters").trim(),
})

export type SignupInput = z.infer<typeof signupSchema>

// Optional: signup with confirm password
export const signupWithConfirmSchema = signupSchema.extend({
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

export type SignupWithConfirmInput = z.infer<typeof signupWithConfirmSchema>

// Forgot password schema
export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address").transform((s) => s.trim().toLowerCase()),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

// Reset password schema
export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
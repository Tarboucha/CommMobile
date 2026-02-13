import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Health check endpoint for Docker and monitoring
 * Returns 200 if the application is running
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: "kodo-mobile-backend",
      version: process.env.RELEASE_VERSION || "1.0.0",
    },
    { status: 200 }
  );
}


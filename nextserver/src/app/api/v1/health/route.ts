import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";

/**
 * GET /api/v1/health
 * Deep health check: verifies DB connectivity with `SELECT 1`.
 * Docker's HEALTHCHECK hits this every 30s; deploy scripts hit it post-deploy.
 * Returns 503 if the DB is unreachable.
 *
 * Successful checks do NOT log (would generate significant noise at 30s cadence).
 * Failures log at warn level so real DB outages surface in Loki/alerts.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    log.warn({ err }, "health check failed — DB query rejected");
    return NextResponse.json(
      {
        status: "unhealthy",
        reason: "database unreachable",
        timestamp: new Date().toISOString(),
        service: "kodo-mobile-backend",
      },
      { status: 503 }
    );
  }

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

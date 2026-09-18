// src/app/api/health/route.ts
// نقطة فحص صحة النظام — تُستخدم من قبل خدمات المراقبة (Render/Vercel/UptimeRobot)
import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  const startedAt = Date.now();

  try {
    await db.execute(sql`SELECT 1`);
    const dbLatencyMs = Date.now() - startedAt;

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        database: { connected: true, latencyMs: dbLatencyMs },
        version: process.env.npm_package_version ?? "unknown",
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        database: { connected: false, error: error instanceof Error ? error.message : "unknown error" },
      },
      { status: 503 }
    );
  }
}

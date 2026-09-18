import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db }   from "@/db";
import { notifications } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req:NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error:"غير مصرح" }, { status:401 });
  const userId = session.user.id;
  await db.update(notifications)
    .set({ isRead:true, readAt:new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return NextResponse.json({ success:true });
}

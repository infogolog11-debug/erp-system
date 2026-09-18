// src/core/actions/chatter.ts
"use server";
import { db } from "@/db";
import { chatterMessages } from "@/db/schema";
import { revalidatePath } from "next/cache";

export async function addChatterMessage({
  tableName, recordId, organizationId, userId, message,
}: {
  tableName: string; recordId: string;
  organizationId: string; userId: string; message: string;
}) {
  if (!message.trim()) return;
  await db.insert(chatterMessages).values({
    tableName, recordId, organizationId,
    userId, message: message.trim(),
    messageType: "comment",
  });
  revalidatePath(`/${tableName}/${recordId}`);
}

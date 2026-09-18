import { NextRequest, NextResponse } from "next/server";
import { auth }         from "@/auth";
import { db }           from "@/db";
import { attachments }  from "@/db/schema";
import { uploadFile }   from "@/lib/storage/upload";
import { errMsg } from "@/types/db";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg","image/png","image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error:"غير مصرح" }, { status:401 });

  const orgId  = session.user.organizationId;
  const userId = session.user.id;

  const rl = checkRateLimit(`upload:${userId}`, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error:"عدد كبير من عمليات الرفع — حاول لاحقاً" }, { status:429 });
  }

  try {
    const formData   = await req.formData();
    const file       = formData.get("file") as File;
    const recordType = formData.get("recordType") as string;
    const recordId   = formData.get("recordId")   as string;
    const folder     = formData.get("folder")     as string ?? "general";

    if (!file)           return NextResponse.json({ error:"لم يُحدد ملف" },          { status:400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error:"حجم الملف يتجاوز 10MB" }, { status:400 });
    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json({ error:"نوع الملف غير مسموح — PDF, Word, Excel, صور فقط" }, { status:400 });

    // رفع الملف
    const result = await uploadFile({
      file, filename:file.name, mimeType:file.type, folder, orgId,
    });

    // حفظ في قاعدة البيانات
    const [attachment] = await db.insert(attachments).values({
      organizationId: orgId,
      tableName:      recordType ?? "general",
      recordId:       recordId ?? "00000000-0000-0000-0000-000000000000",
      fileName:       result.filename,
      fileSize:       result.size,
      mimeType:       result.mimeType,
      storageKey:     result.key,
      fileUrl:        result.url,
      uploadedBy:     userId,
    }).returning();

    return NextResponse.json({ success:true, attachment });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status:500 });
  }
}

// حذف مرفق
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error:"غير مصرح" }, { status:401 });
  const orgId = session.user.organizationId;

  const { id } = await req.json();
  const { deleteFile } = await import("@/lib/storage/upload");
  const { eq, and } = await import("drizzle-orm");

  const att = await db.query.attachments.findFirst({ where:eq(attachments.id, id) });
  if (!att) return NextResponse.json({ error:"غير موجود" }, { status:404 });
  if (att.organizationId !== orgId) return NextResponse.json({ error:"غير مصرَّح" }, { status:403 });

  if (att.storageKey) await deleteFile(att.storageKey);
  await db.delete(attachments).where(and(eq(attachments.id, id), eq(attachments.organizationId, orgId)));

  return NextResponse.json({ success:true });
}

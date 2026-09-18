"use server";
import { errMsg } from "@/types/db";
import { db }           from "@/db";
import { fiscalPeriods, journalEntries } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { createAuditLog }    from "@/core/audit/audit-trail";
import { revalidatePath }    from "next/cache";

type ActionResult<T=void> = { success:true; data:T } | { success:false; error:string };

export async function toggleFiscalPeriod(
  periodId: string,
  close:    boolean,
  userId:   string,
  orgId:    string,
): Promise<ActionResult<{ msg:string }>> {
  try {
    const period = await db.query.fiscalPeriods.findFirst({
      where: and(eq(fiscalPeriods.id,periodId), eq(fiscalPeriods.organizationId,orgId)),
    });
    if (!period) return { success:false, error:"الفترة غير موجودة" };

    // عند الإقفال: التحقق من عدم وجود قيود معلقة في هذه الفترة
    if (close) {
      const pendingEntries = await db.query.journalEntries.findFirst({
        where: and(
          eq(journalEntries.organizationId, orgId),
          eq(journalEntries.status, "draft"),
          gte(journalEntries.entryDate, period.startDate),
          lte(journalEntries.entryDate, period.endDate),
        ),
      });
      if (pendingEntries) {
        return { success:false, error:"توجد قيود مسودة في هذه الفترة — يرجى ترحيلها أو حذفها أولاً" };
      }
    }

    await db.update(fiscalPeriods)
      .set({
        isClosed:   close,
        updatedAt:  new Date(),
      })
      .where(and(eq(fiscalPeriods.id,periodId), eq(fiscalPeriods.organizationId,orgId)));

    await createAuditLog({
      organizationId: orgId, userId,
      tableName:"fiscal_periods", recordId:periodId,
      action:"UPDATE",
      newValues:{ isClosed:close },
    });

    revalidatePath("/settings/fiscal-year");
    return { success:true, data:{ msg: close ? "تم إقفال الفترة" : "تم إعادة فتح الفترة" } };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}

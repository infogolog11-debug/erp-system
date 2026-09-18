"use client";
import { getQueuedItems, removeQueuedItem, updateQueuedItem } from "./indexeddb-queue";
import { isRetryExceeded } from "./queue-logic";
import { createBeneficiary } from "@/modules/beneficiaries/actions";
import { createDistribution } from "@/modules/beneficiaries/actions";

export interface SyncResult { synced: number; failed: number; dropped: number; }

// يُشغَّل عند استعادة الاتصال — يمرّ على كل عنصر بالطابور ويحاول إرساله فعلياً عبر server action
export async function flushQueue(userId: string): Promise<SyncResult> {
  const items = await getQueuedItems();
  let synced = 0, failed = 0, dropped = 0;

  for (const item of items) {
    try {
      let result: { success: boolean; error?: string };
      if (item.formType === "beneficiary_registration") {
        result = await createBeneficiary(item.payload, userId);
      } else if (item.formType === "distribution") {
        result = await createDistribution(item.payload, userId);
      } else {
        result = { success: false, error: "نوع نموذج غير معروف" };
      }

      if (result.success) {
        await removeQueuedItem(item.id);
        synced++;
      } else {
        item.attempts += 1;
        item.lastError = result.error;
        if (isRetryExceeded(item)) {
          // لا نحذف البيانات نهائياً — نتركها في الطابور لمراجعة يدوية بعد استنفاد المحاولات
          dropped++;
        }
        await updateQueuedItem(item);
        failed++;
      }
    } catch (e) {
      item.attempts += 1;
      item.lastError = e instanceof Error ? e.message : "خطأ غير معروف";
      await updateQueuedItem(item);
      failed++;
    }
  }

  return { synced, failed, dropped };
}

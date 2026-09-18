"use server";
import { errMsg } from "@/types/db";

import { db } from "@/db";
import {
  assets, depreciationSchedules, journalEntries, journalLines, accounts,
  fiscalPeriods, currencies,
} from "@/db/schema";
import { createAuditLog } from "@/core/audit/audit-trail";
import { revalidatePath } from "next/cache";
import { eq, and, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { requirePermission, assertOrgMatches } from "@/lib/auth/guard";
// ── حاسبة الاستهلاك (مدمجة من nexus-erp) ──
import {
  calculateMonthlyDepreciation,
  generateDepreciationSchedule,
  type DepreciationInput,
} from "@/lib/inventory/depreciation";

type ActionResult<T=void> =
  | { success:true; data:T }
  | { success:false; error:string };

// ─── احتساب الاستهلاك الشهري لأصل واحد ─────────────────────────────────────
export async function runMonthlyDepreciation(
  assetId:        string,
  periodDate:     string, // "YYYY-MM"
  userId:         string,
  organizationId: string,
  postToAccounting: boolean = false,
): Promise<ActionResult<{ depreciationAmt:number; closingValue:number }>> {
  try {
    const session = await requirePermission("inventory", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const asset = await db.query.assets.findFirst({
      where: eq(assets.id, assetId),
    });
    if (!asset) return { success:false, error:"الأصل غير موجود" };
    if (asset.organizationId !== organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };
    if (!asset.usefulLifeYears || !asset.purchaseCost) {
      return { success:false, error:"بيانات الأصل غير مكتملة للاستهلاك" };
    }

    // التحقق من عدم وجود سجل لنفس الفترة
    const existing = await db.query.depreciationSchedules.findFirst({
      where: and(
        eq(depreciationSchedules.assetId, assetId),
        eq(depreciationSchedules.periodDate, periodDate),
      ),
    });
    if (existing) return { success:false, error:`الاستهلاك لفترة ${periodDate} مسجل مسبقاً` };

    const input: DepreciationInput = {
      purchaseValue:           Number(asset.purchaseCost),
      salvageValue:            Number(asset.salvageValue ?? 0),
      usefulLifeYears:         asset.usefulLifeYears,
      currentValue:            Number(asset.currentValue ?? asset.purchaseCost),
      accumulatedDepreciation: Number(asset.purchaseCost) - Number(asset.currentValue ?? asset.purchaseCost),
      depreciationMethod:      (asset.depreciationMethod ?? "straight_line") as "straight_line"|"declining_balance",
      purchaseDate:            asset.purchaseDate.toISOString(),
    };

    const result = calculateMonthlyDepreciation(input);

    await db.transaction(async (tx) => {
      // تسجيل سجل الاستهلاك
      const [schedule] = await tx.insert(depreciationSchedules).values({
        assetId,
        organizationId,
        periodDate,
        openingValue:    String(input.currentValue),
        depreciationAmt: String(result.monthlyDepreciation),
        closingValue:    String(result.newBookValue),
        isPosted:        postToAccounting,
        createdBy:       userId,
      }).returning();

      // تحديث القيمة الدفترية للأصل
      await tx.update(assets)
        .set({
          currentValue:       String(result.newBookValue),
          updatedAt:          new Date(),
        })
        .where(eq(assets.id, assetId));

      // قيد محاسبي تلقائي إذا طُلب
      if (postToAccounting) {
        const deprExpenseAcc = await db.query.accounts.findFirst({
          where: and(eq(accounts.code, "5300"), eq(accounts.organizationId, organizationId)),
        });
        const accumDeprAcc = await db.query.accounts.findFirst({
          where: and(eq(accounts.code, "1500"), eq(accounts.organizationId, organizationId)),
        });

        if (deprExpenseAcc && accumDeprAcc) {
          const today = new Date();
          const [period, baseCurrency] = await Promise.all([
            db.query.fiscalPeriods.findFirst({
              where: and(
                eq(fiscalPeriods.organizationId, organizationId),
                sql`${fiscalPeriods.startDate} <= ${today.toISOString().split("T")[0]}`,
                sql`${fiscalPeriods.endDate} >= ${today.toISOString().split("T")[0]}`,
              ),
            }),
            db.query.currencies.findFirst({ where: eq(currencies.isBase, true) }),
          ]);

          if (period && baseCurrency) {
            const [je] = await tx.insert(journalEntries).values({
              organizationId,
              fiscalPeriodId: period.id,
              currencyId:   baseCurrency.id,
              code:         `DEPR-${periodDate}-${assetId.slice(0,8)}`,
              entryDate:    new Date(),
              description:  `استهلاك شهري: ${asset.name} — ${periodDate}`,
              entryType:    "depreciation",
              totalDebit:   String(result.monthlyDepreciation),
              totalCredit:  String(result.monthlyDepreciation),
              isPosted:     true,
              postedAt:     new Date(),
              postedBy:     userId,
              createdBy:    userId,
            }).returning();

            await tx.insert(journalLines).values([
              {
                journalEntryId: je.id, organizationId,
                accountId:      deprExpenseAcc.id,
                description:    `مصروف استهلاك — ${asset.name}`,
                debitAmount:    String(result.monthlyDepreciation),
                creditAmount:   "0",
                lineOrder:      1,
                createdBy:      userId,
              },
              {
                journalEntryId: je.id, organizationId,
                accountId:      accumDeprAcc.id,
                description:    `مجمع استهلاك — ${asset.name}`,
                debitAmount:    "0",
                creditAmount:   String(result.monthlyDepreciation),
                lineOrder:      2,
                createdBy:      userId,
              },
            ]);

            await tx.update(depreciationSchedules)
              .set({ journalEntryId: je.id })
              .where(eq(depreciationSchedules.id, schedule.id));
          }
        }
      }
    });

    await createAuditLog({
      organizationId, userId,
      tableName:"assets", recordId:assetId,
      action:"UPDATE",
      newValues:{ periodDate, depreciationAmt:result.monthlyDepreciation, closingValue:result.newBookValue },
    });

    revalidatePath("/inventory/assets");
    return { success:true, data:{ depreciationAmt:result.monthlyDepreciation, closingValue:result.newBookValue } };
  } catch (e) {
    return { success:false, error:errMsg(e, "حدث خطأ في احتساب الاستهلاك") };
  }
}

// ─── تشغيل الاستهلاك لجميع الأصول النشطة (batch) ────────────────────────────
export async function runBatchDepreciation(
  periodDate:     string,
  userId:         string,
  organizationId: string,
  postToAccounting: boolean = false,
): Promise<ActionResult<{ processed:number; skipped:number; errors:string[] }>> {
  try {
    const session = await requirePermission("inventory", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const allAssets = await db.query.assets.findMany({
      where: and(
        eq(assets.organizationId, organizationId),
        isNull(assets.disposalDate),
      ),
    });

    let processed = 0, skipped = 0;
    const errors: string[] = [];

    // ── تشغيل الاستهلاك بدفعات متوازية محدودة بدل استعلام تسلسلي واحد تلو
    //    الآخر — كل أصل له معاملته (transaction) وقيده المحاسبي المستقل
    //    (كود القيد فريد لكل أصل+فترة)، فما فيه تعارض بين الأصول ببعضها،
    //    وده يخلي التوازي آمن. حجم الدفعة محدود لتفادي إغراق pool الاتصالات.
    const CONCURRENCY = 10;
    for (let i = 0; i < allAssets.length; i += CONCURRENCY) {
      const batch = allAssets.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(asset =>
          runMonthlyDepreciation(asset.id, periodDate, userId, organizationId, postToAccounting)
            .then(res => ({ asset, res }))
        )
      );
      for (const { asset, res } of results) {
        if (res.success) processed++;
        else if (res.error.includes("مسبقاً")) skipped++;
        else errors.push(`${asset.name}: ${res.error}`);
      }
    }

    revalidatePath("/inventory/assets");
    return { success:true, data:{ processed, skipped, errors } };
  } catch (e) {
    return { success:false, error:errMsg(e, "خطأ في الاستهلاك الجماعي") };
  }
}

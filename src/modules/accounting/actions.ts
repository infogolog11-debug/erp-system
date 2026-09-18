"use server";

import { db } from "@/db";
import {
  journalEntries, journalLines, accounts, fiscalPeriods
} from "@/db/schema";
import { createAuditLog } from "@/core/audit/audit-trail";
import { revalidatePath } from "next/cache";
import { eq, and, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { requirePermission, assertOrgMatches } from "@/lib/auth/guard";
import { withIdempotency, IdempotencyInProgressError } from "@/lib/idempotency/guard";

type ActionResult<T=void> =
  | { success:true; data:T }
  | { success:false; error:string };

interface JournalLineInput {
  accountId:    string;
  description?: string;
  debitAmount:  number;
  creditAmount: number;
  grantId?:     string;
}

// ─── Create Journal Entry ─────────────────
export async function createJournalEntry(params: {
  organizationId: string;
  fiscalPeriodId: string;
  grantId?:       string;
  description:    string;
  reference?:     string;
  entryType:      string;
  currencyId:     string;
  lines:          JournalLineInput[];
  userId:         string;
  idempotencyKey?: string; // يمنع إنشاء قيد مكرر عند إعادة إرسال نفس الطلب
}): Promise<ActionResult<{id:string;code:string}>> {
  try {
    const session = await requirePermission("accounting", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(params.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    return await withIdempotency(params.organizationId, params.idempotencyKey, "createJournalEntry", () => createJournalEntryInner(params));
  } catch (e) {
    if (e instanceof IdempotencyInProgressError) return { success:false, error:e.message };
    console.error(e);
    return { success:false, error:"حدث خطأ في إنشاء القيد" };
  }
}

async function createJournalEntryInner(params: {
  organizationId: string; fiscalPeriodId: string; grantId?: string; description: string;
  reference?: string; entryType: string; currencyId: string; lines: JournalLineInput[]; userId: string;
}): Promise<ActionResult<{id:string;code:string}>> {
  try {
    // نفس مبدأ الطبقات: entryType مقيّد بـ CHECK constraint بقاعدة
    // البيانات (v32)، لكن هذه الدالة لا تُستدعى حالياً إلا من كود خادمي
    // بقيم ثابتة آمنة (depreciation, reversal). نتحقق هنا أيضاً كخط دفاع
    // استباقي — خصوصاً أن "manual" بالقائمة يشير لنية بناء نموذج إدخال
    // يدوي لاحقاً، وقتها سيصير هذا التحقق هو خط الدفاع الأول الفعلي.
    const ALLOWED_ENTRY_TYPES = ["manual","procurement","payroll","depreciation","payment","reversal"];
    if (!ALLOWED_ENTRY_TYPES.includes(params.entryType))
      return { success:false, error:`نوع القيد غير صحيح: ${params.entryType}` };

    // ─── إصلاح: كانت هذه التحققات موجودة فقط كـ CHECK constraint بقاعدة
    // البيانات (v32) بدون أي تحقق مطابق بالتطبيق — يعني لو صار الخطأ،
    // المستخدم كان بياخذ رسالة Postgres خام غير مفهومة بدل رسالة عربية
    // واضحة قبل ما توصل القاعدة أصلاً. القاعدة تبقى خط الدفاع الأخير
    // (لو تجاوزها كود آخر لاحقاً)، لكن التطبيق لازم يمنعها أولاً بنفسه —
    // هذا نفس مبدأ التحقق المتعدد الطبقات (layered validation) المعتمد
    // بأنظمة ناضجة مثل Odoo (تحقق ORM قبل تحقق DB)، لا الاعتماد على DB فقط.
    for (const line of params.lines) {
      if (line.debitAmount < 0 || line.creditAmount < 0)
        return { success:false, error:"لا يمكن أن يكون مبلغ المدين أو الدائن بالسطر سالباً" };
      if (line.debitAmount > 0 && line.creditAmount > 0)
        return { success:false, error:"لا يمكن أن يحتوي سطر القيد على مدين ودائن معاً — استخدم سطرين منفصلين" };
      if (line.debitAmount === 0 && line.creditAmount === 0)
        return { success:false, error:"يجب أن يحتوي كل سطر قيمة مدين أو دائن (لا يجوز أن يكون السطر فارغاً)" };
    }

    // التحقق من توازن القيد (مجموع المدين = مجموع الدائن)
    const totalDebit  = params.lines.reduce((s,l)=>s+l.debitAmount, 0);
    const totalCredit = params.lines.reduce((s,l)=>s+l.creditAmount, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return {
        success:false,
        error:`القيد غير متوازن: المدين ${totalDebit.toFixed(2)} ≠ الدائن ${totalCredit.toFixed(2)}`,
      };
    }

    // التحقق من الفترة المحاسبية
    // إصلاح IDOR (اكتُشف بمراجعة v35 — نفس نمط budgetLineId بـgrants
    // ونمط vehicleId/driverId بـfleet): كانت هذه الدالة تجلب الفترة
    // المحاسبية بمعرّفها فقط دون أي تحقق من ملكيتها للمنظمة المستدعية.
    // مستخدم من منظمة A كان يقدر يمرّر fiscalPeriodId يخص منظمة B، فيُنشأ
    // قيد منظمة A داخل فترة محاسبية تابعة لمنظمة أخرى فعلياً — تلوّث حالة
    // إقفال/فتح الفترات المحاسبية عبر حدود المستأجرين (مثلاً: تحديد ما إذا
    // كانت فترة منظمة B "مغلقة" بالاعتماد على بيانات لا علاقة لمنظمة A بها،
    // وربط قيد منظمة A بجدول فترات منظمة B في التقارير).
    const period = await db.query.fiscalPeriods.findFirst({
      where: eq(fiscalPeriods.id, params.fiscalPeriodId),
    });
    if (!period) return { success:false, error:"الفترة المحاسبية غير موجودة" };
    if (period.organizationId !== params.organizationId) return { success:false, error:"الفترة المحاسبية غير موجودة" };
    if (period.isClosed) return { success:false, error:"الفترة المحاسبية مغلقة" };

    // إصلاح IDOR إضافي (نفس المراجعة): accountId بكل سطر مُرسَل من العميل
    // ويُدرَج مباشرة بـjournalLines دون أي تحقق من ملكيته للمنظمة. الأثر:
    // مستخدم من منظمة A يقدر يُنشئ قيداً يحرّك حساباً (accounts.currentBalance)
    // تابعاً لمنظمة B فعلياً — ترحيل القيد لاحقاً (postJournalEntry) كان
    // سيُحدّث رصيد ذلك الحساب دون أي فحص إضافي (raw eq(accounts.id, ...)
    // بلا شرط organizationId هناك أيضاً، لأنه يثق ضمنياً بأن كل accountId
    // بسطور القيد يخص نفس منظمة القيد). نتحقق دفعة واحدة من كل الحسابات
    // المستخدَمة بدل استعلام منفصل لكل سطر.
    const accountIds = [...new Set(params.lines.map(l => l.accountId))];
    const ownedAccounts = await db.query.accounts.findMany({
      where: and(inArray(accounts.id, accountIds), eq(accounts.organizationId, params.organizationId)),
    });
    if (ownedAccounts.length !== accountIds.length) {
      return { success:false, error:"أحد الحسابات المحاسبية غير موجود أو لا يتبع هذه المنظمة" };
    }

    // توليد كود القيد
    const count = await db.select({ c:sql`count(*)` }).from(journalEntries);
    const seq = Number(count[0].c) + 1;
    const code = `JE-${new Date().getFullYear()}-${String(seq).padStart(6,"0")}`;

    const result = await db.transaction(async (tx) => {
      const [entry] = await tx.insert(journalEntries).values({
        organizationId: params.organizationId,
        fiscalPeriodId: params.fiscalPeriodId,
        grantId:        params.grantId,
        code,
        entryDate:      new Date(),
        description:    params.description,
        reference:      params.reference,
        entryType:      params.entryType,
        totalDebit:     String(totalDebit),
        totalCredit:    String(totalCredit),
        currencyId:     params.currencyId,
        isPosted:       false,
        createdBy:      params.userId,
      }).returning();

      await tx.insert(journalLines).values(
        params.lines.map((line, i) => ({
          journalEntryId: entry.id,
          accountId:      line.accountId,
          organizationId: params.organizationId,
          grantId:        line.grantId || params.grantId,
          description:    line.description,
          debitAmount:    String(line.debitAmount),
          creditAmount:   String(line.creditAmount),
          lineOrder:      i + 1,
          createdBy:      params.userId,
        }))
      );

      // إصلاح v32: التدقيق داخل نفس المعاملة — فشل تسجيله يُلغي القيد كله
      await createAuditLog({
        organizationId: params.organizationId,
        userId: params.userId,
        tableName:"journal_entries", recordId:entry.id,
        action:"CREATE",
        newValues:{ code, totalDebit, totalCredit },
      }, tx);

      return entry;
    });

    revalidatePath("/accounting");
    return { success:true, data:{ id:result.id, code } };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ في إنشاء القيد" };
  }
}

// ─── Post Journal Entry ───────────────────
export async function postJournalEntry(
  entryId: string,
  userId: string,
  organizationId: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("accounting", "approve");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    // ملاحظة idempotency: الترحيل نفسه idempotent طبيعياً بفحص entry.isPosted
    // أدناه (استدعاء ثانٍ لنفس entryId يُرفض فوراً بـ"مرحَّل بالفعل")، لذا لا
    // يحتاج مفتاح idempotency منفصل خلافاً لإنشاء القيد (الذي يولّد سجلاً
    // جديداً في كل استدعاء ولو كانت المدخلات متطابقة).
    const entry = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, entryId),
      with: { lines: { with: { account: true } } },
    });
    if (!entry) return { success:false, error:"القيد غير موجود" };
    if (entry.organizationId !== organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };
    if (entry.isPosted) return { success:false, error:"القيد مرحَّل بالفعل" };

    // إصلاح: كان يُتحقَّق من إغلاق الفترة عند *إنشاء* القيد فقط، وليس عند
    // *ترحيله*. سيناريو الثغرة: قيد أُنشئ والفترة مفتوحة، ثم أُقفلت الفترة
    // (مثلاً بعد إقفال الجرد السنوي)، ثم يُرحَّل القيد لاحقاً بلا مانع —
    // فتتغيّر أرصدة فترة مُقفلة رسمياً. نعيد الفحص هنا أيضاً، والقراءة
    // داخل نفس الـ transaction لمنع سباق مع عملية إغلاق فترة متزامنة.
    const result = await db.transaction(async (tx) => {
      const period = await tx.query.fiscalPeriods.findFirst({ where: eq(fiscalPeriods.id, entry.fiscalPeriodId) });
      if (period?.isClosed) throw new Error("الفترة المحاسبية مغلقة — لا يمكن ترحيل قيد إليها");

      // ترحيل القيد
      await tx.update(journalEntries)
        .set({ isPosted:true, postedAt:new Date(), postedBy:userId })
        .where(eq(journalEntries.id, entryId));

      // تحديث أرصدة الحسابات — نجمع صافي الأثر لكل حساب أولاً (قد يتكرر نفس
      // الحساب بأكثر من سطر بنفس القيد) ثم نحدّث كل حساب مرة واحدة فقط
      // بدل استعلام UPDATE منفصل لكل سطر
      const balanceDeltaByAccount = new Map<string, number>();
      for (const line of entry.lines) {
        const netEffect = Number(line.debitAmount) - Number(line.creditAmount);
        balanceDeltaByAccount.set(
          line.accountId,
          (balanceDeltaByAccount.get(line.accountId) ?? 0) + netEffect,
        );
      }
      for (const [accountId, delta] of balanceDeltaByAccount) {
        await tx.update(accounts)
          .set({
            currentBalance: sql`current_balance + ${String(delta)}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, accountId));
      }

      // إصلاح v32: داخل نفس المعاملة — فشل تسجيل التدقيق يُلغي الترحيل كله
      await createAuditLog({
        organizationId, userId,
        tableName:"journal_entries", recordId:entryId,
        action:"UPDATE",
        oldValues:{ isPosted:false },
        newValues:{ isPosted:true },
      }, tx);
    });

    revalidatePath("/accounting");
    return { success:true, data:undefined };
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "حدث خطأ في ترحيل القيد";
    return { success:false, error: msg === "الفترة المحاسبية مغلقة — لا يمكن ترحيل قيد إليها" ? msg : "حدث خطأ في ترحيل القيد" };
  }
}

// ─── Reverse Journal Entry (عكس قيد مرحَّل) ─────
// كان مفقوداً بالكامل: لا توجد أي طريقة لتصحيح قيد مرحَّل سوى تعديله
// مباشرة، وهو ما يدمّر الأثر المحاسبي (Audit Trail) ويمنع مطابقة الأرصدة
// التاريخية. هذه الدالة تنشئ قيد عكسي جديد (مدين↔دائن مقلوبان) بدل
// التعديل المباشر، وتربطه بالقيد الأصلي عبر reversalEntryId/isReversed —
// الأعمدة كانت موجودة بالسكيما مسبقاً لكن بلا أي دالة تستخدمها.
export async function reverseJournalEntry(
  entryId: string,
  userId: string,
  organizationId: string,
  reason: string,
  targetFiscalPeriodId?: string, // فترة القيد العكسي؛ افتراضياً أول فترة مفتوحة إن لم تُحدَّد
): Promise<ActionResult<{ id:string; code:string }>> {
  try {
    const session = await requirePermission("accounting", "approve");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };
    if (!reason?.trim()) return { success:false, error:"سبب العكس إلزامي (للأثر المحاسبي)" };

    const original = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, entryId),
      with: { lines: true },
    });
    if (!original) return { success:false, error:"القيد غير موجود" };
    if (original.organizationId !== organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };
    if (!original.isPosted) return { success:false, error:"لا يمكن عكس قيد غير مرحَّل — احذفه مباشرة بدلاً من ذلك" };
    if (original.isReversed) return { success:false, error:"القيد معكوس بالفعل" };

    const result = await db.transaction(async (tx) => {
      const periodId = targetFiscalPeriodId ?? original.fiscalPeriodId;
      const period = await tx.query.fiscalPeriods.findFirst({ where: eq(fiscalPeriods.id, periodId) });
      // إصلاح IDOR (نفس نمط createJournalEntryInner أعلاه): targetFiscalPeriodId
      // معامل اختياري يُرسَل من العميل مباشرة — بلا هذا الفحص يقدر مستخدم من
      // منظمة A يسجّل قيد العكس داخل فترة محاسبية تابعة لمنظمة B.
      if (!period || period.organizationId !== organizationId) throw new Error("الفترة المحاسبية المستهدفة غير موجودة");
      if (period.isClosed) throw new Error("لا يمكن تسجيل قيد العكس في فترة مغلقة — حدد فترة مفتوحة");

      const count = await tx.select({ c:sql`count(*)` }).from(journalEntries);
      const seq = Number(count[0].c) + 1;
      const code = `JE-REV-${new Date().getFullYear()}-${String(seq).padStart(6,"0")}`;

      const [reversalEntry] = await tx.insert(journalEntries).values({
        organizationId, fiscalPeriodId: periodId,
        grantId: original.grantId,
        code,
        entryDate: new Date(),
        description: `عكس القيد ${original.code} — ${reason}`,
        reference: original.code,
        entryType: "reversal",
        totalDebit: original.totalCredit,   // مقلوب
        totalCredit: original.totalDebit,   // مقلوب
        currencyId: original.currencyId,
        isPosted: true,
        postedAt: new Date(),
        postedBy: userId,
        createdBy: userId,
      }).returning();

      await tx.insert(journalLines).values(
        original.lines.map((line, i) => ({
          journalEntryId: reversalEntry.id,
          accountId: line.accountId,
          organizationId,
          grantId: line.grantId,
          description: `عكس: ${line.description ?? ""}`,
          debitAmount: line.creditAmount,   // مقلوب
          creditAmount: line.debitAmount,   // مقلوب
          lineOrder: i + 1,
          createdBy: userId,
        }))
      );

      // تحديث أرصدة الحسابات بنفس منطق الترحيل (صافي الأثر لكل حساب)
      const balanceDeltaByAccount = new Map<string, number>();
      for (const line of original.lines) {
        const netEffect = Number(line.creditAmount) - Number(line.debitAmount); // معكوس
        balanceDeltaByAccount.set(line.accountId, (balanceDeltaByAccount.get(line.accountId) ?? 0) + netEffect);
      }
      for (const [accountId, delta] of balanceDeltaByAccount) {
        await tx.update(accounts)
          .set({ currentBalance: sql`current_balance + ${String(delta)}`, updatedAt: new Date() })
          .where(eq(accounts.id, accountId));
      }

      // ربط القيد الأصلي بالعكسي — لا نعدّل القيد الأصلي غير ذلك، يبقى كما هو تاريخياً
      await tx.update(journalEntries)
        .set({ isReversed:true, reversalEntryId: reversalEntry.id })
        .where(eq(journalEntries.id, entryId));

      // إصلاح v32: التدقيق داخل نفس المعاملة
      await createAuditLog({
        organizationId, userId,
        tableName:"journal_entries", recordId: reversalEntry.id,
        action:"CREATE",
        newValues:{ code: reversalEntry.code, reversalOf: original.code, reason },
      }, tx);

      return reversalEntry;
    });

    revalidatePath("/accounting");
    return { success:true, data:{ id: result.id, code: result.code } };
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "حدث خطأ في عكس القيد";
    return { success:false, error: msg };
  }
}

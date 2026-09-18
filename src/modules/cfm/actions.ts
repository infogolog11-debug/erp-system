"use server";

import { db } from "@/db";
import { complaints, complaintUpdates } from "@/db/schema";
import { createAuditLog } from "@/core/audit/audit-trail";
import { revalidatePath } from "next/cache";
import { eq, and, count } from "drizzle-orm";
import { z } from "zod";
import { computeDueDate } from "@/lib/cfm/sla";
import { textField, optionalTextField, sanitizeText } from "@/lib/security/sanitize";
import { requireSession, requirePermission, assertOrgMatches } from "@/lib/auth/guard";
import { assertOwnedByOrg } from "@/lib/auth/ownership";

type ActionResult<T=void> = { success:true; data:T } | { success:false; error:string };

const CreateComplaintSchema = z.object({
  organizationId: z.string().uuid(),
  channel: z.enum(["hotline","in_person","sms","email","suggestion_box","community_meeting","other"]),
  category: z.enum(["service_quality","staff_conduct","corruption_fraud","sgbv_protection","distribution_issue","eligibility_targeting","data_privacy","suggestion","other"]),
  isAnonymous: z.boolean().default(false),
  complainantName: optionalTextField(150),
  complainantPhone: z.string().optional(),
  beneficiaryId: z.string().uuid().optional(),
  grantId: z.string().uuid().optional(),
  description: textField(3000, 1),
  priority: z.enum(["low","medium","high","critical"]).default("medium"),
});

const SENSITIVE_CATEGORIES = new Set(["corruption_fraud","sgbv_protection"]);

export async function createComplaint(formData: z.infer<typeof CreateComplaintSchema>, userId: string): Promise<ActionResult<{id:string; code:string}>> {
  try {
    const v = CreateComplaintSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("cfm", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const sensitivity = SENSITIVE_CATEGORIES.has(v.data.category) ? "sensitive" as const : "standard" as const;
    const receivedDate = new Date();
    const dueDate = computeDueDate(receivedDate, v.data.priority, sensitivity);

    const [{ cnt }] = await db.select({ cnt: count() }).from(complaints).where(eq(complaints.organizationId, v.data.organizationId));
    const code = `CFM-${new Date().getFullYear()}-${String(Number(cnt)+1).padStart(5,"0")}`;

    const [complaint] = await db.insert(complaints).values({
      organizationId: v.data.organizationId, code,
      channel: v.data.channel, category: v.data.category, sensitivity,
      isAnonymous: v.data.isAnonymous,
      complainantName: v.data.isAnonymous ? undefined : v.data.complainantName,
      complainantPhone: v.data.isAnonymous ? undefined : v.data.complainantPhone,
      beneficiaryId: v.data.beneficiaryId, grantId: v.data.grantId,
      description: v.data.description, priority: v.data.priority,
      receivedDate, dueDate, createdBy: userId,
    }).returning();

    await createAuditLog({
      organizationId: v.data.organizationId, userId,
      tableName:"complaints", recordId:complaint.id, action:"CREATE",
      newValues:{ code, category: v.data.category, sensitivity },
    });

    revalidatePath("/cfm");
    return { success:true, data:{ id:complaint.id, code } };
  } catch (e) { console.error(e); return { success:false, error:"حدث خطأ غير متوقع" }; }
}

export async function updateComplaintStatus(
  complaintId: string, organizationId: string, userId: string,
  status: "received"|"under_review"|"investigating"|"resolved"|"closed"|"escalated",
  resolutionSummary?: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("cfm", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    await db.update(complaints)
      .set({
        complaintStatus: status,
        resolutionSummary: resolutionSummary ? sanitizeText(resolutionSummary) : resolutionSummary,
        resolvedDate: (status === "resolved" || status === "closed") ? new Date() : null,
        updatedBy: userId, updatedAt: new Date(),
      })
      .where(and(eq(complaints.id, complaintId), eq(complaints.organizationId, organizationId)));

    await createAuditLog({
      organizationId, userId, tableName:"complaints", recordId:complaintId,
      action:"UPDATE", newValues:{ complaintStatus: status },
    });

    revalidatePath("/cfm");
    revalidatePath(`/cfm/${complaintId}`);
    return { success:true, data:undefined };
  } catch (e) { console.error(e); return { success:false, error:"حدث خطأ غير متوقع" }; }
}

export async function assignComplaint(complaintId: string, assigneeId: string, organizationId: string, userId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("cfm", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    await db.update(complaints).set({ assignedTo: assigneeId, complaintStatus:"under_review", updatedBy:userId, updatedAt:new Date() }).where(and(eq(complaints.id, complaintId), eq(complaints.organizationId, organizationId)));
    revalidatePath(`/cfm/${complaintId}`);
    return { success:true, data:undefined };
  } catch (e) { console.error(e); return { success:false, error:"حدث خطأ غير متوقع" }; }
}

export async function addComplaintUpdate(complaintId: string, organizationId: string, update: string, userId: string): Promise<ActionResult> {
  try {
    if (!update.trim()) return { success:false, error:"لا يمكن إضافة تحديث فارغ" };

    const session = await requirePermission("cfm", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    // إصلاح IDOR (v35 — راجع نفس الإصلاح والشرح بـ`addCaseNote` ببeneficiaries/actions.ts):
    // complaintId مُرسَل من العميل بلا تحقق ملكية سابقاً.
    // موحَّد الآن عبر assertOwnedByOrg (v38) — راجع SECURITY_NOTES.md
    if (!(await assertOwnedByOrg(complaints, complaintId, organizationId))) {
      return { success:false, error:"الشكوى غير موجودة أو لا تتبع هذه المنظمة" };
    }

    const [update_] = await db.insert(complaintUpdates).values({ complaintId, organizationId, update: sanitizeText(update), createdBy: userId }).returning();
    // إصلاح (audit log integrity v35): كانت هذه الدالة تُدرج بلا أي تسجيل تدقيق.
    await createAuditLog({ organizationId, userId, tableName:"complaint_updates", recordId:update_.id, action:"CREATE", newValues:{ complaintId } });
    revalidatePath(`/cfm/${complaintId}`);
    return { success:true, data:undefined };
  } catch (e) { console.error(e); return { success:false, error:"حدث خطأ غير متوقع" }; }
}

export async function recordSatisfactionRating(complaintId: string, organizationId: string, rating: number, userId: string): Promise<ActionResult> {
  try {
    if (rating < 1 || rating > 5) return { success:false, error:"التقييم يجب أن يكون بين 1 و5" };

    const session = await requireSession();
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    await db.update(complaints).set({ satisfactionRating: rating, updatedBy:userId, updatedAt:new Date() }).where(and(eq(complaints.id, complaintId), eq(complaints.organizationId, organizationId)));
    revalidatePath(`/cfm/${complaintId}`);
    return { success:true, data:undefined };
  } catch (e) { console.error(e); return { success:false, error:"حدث خطأ غير متوقع" }; }
}

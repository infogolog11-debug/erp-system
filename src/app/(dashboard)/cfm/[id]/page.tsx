import { auth } from "@/auth";
import { db } from "@/db";
import { complaints, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getUserPermission, canView } from "@/lib/permissions/service";
import CFMDetailView from "@/modules/cfm/components/CFMDetailView";

export default async function ComplaintDetailPage({
  params: paramsPromise,
}: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session?.user) notFound();
  const orgId = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "cfm", session.user.role);
  if (!canView(__perm)) redirect("/");

  const complaint = await db.query.complaints.findFirst({
    where: eq(complaints.id, params.id),
    with: { updates: { orderBy:(t,{desc})=>[desc(t.createdAt)] }, assignee: true, beneficiary: true, grant: { columns:{id:true,name:true,nameAr:true} } },
  });
  if (!complaint || complaint.organizationId !== orgId) notFound();

  const perm = await getUserPermission(session.user.id, orgId, "cfm", session.user.role);
  const canSeeSensitive = perm === "admin";
  if (complaint.sensitivity === "sensitive" && !canSeeSensitive) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#2A1215] border border-[#4A1C20] rounded-2xl p-8 text-center space-y-2">
          <i className="ti ti-lock text-3xl text-[#E24B4A]"/>
          <p className="text-white font-medium">هذه شكوى حساسة — الوصول مقيَّد</p>
          <p className="text-[13px] text-[#9CA3AF]">يُرجى التواصل مع مسؤول الحماية أو الإدارة العليا للاطلاع على التفاصيل</p>
        </div>
      </div>
    );
  }

  const orgUsers = await db.query.users.findMany({ where: eq(users.organizationId, orgId), columns:{id:true,firstName:true,lastName:true} });

  return <CFMDetailView complaint={complaint as any} orgUsers={orgUsers} userId={session.user.id} organizationId={orgId} />;
}

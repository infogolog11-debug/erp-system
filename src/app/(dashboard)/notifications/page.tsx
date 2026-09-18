import { auth }          from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db }            from "@/db";
import { notifications } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import Link              from "next/link";

const TYPE_STYLE: Record<string,{ icon:string; color:string; bg:string; border:string }> = {
  approval: { icon:"ti-shield-check",   color:"text-[#378ADD]", bg:"bg-[#0A1628]", border:"border-[#1A3060]" },
  alert:    { icon:"ti-alert-triangle", color:"text-[#E24B4A]", bg:"bg-[#2A1215]", border:"border-[#4A1C20]" },
  warning:  { icon:"ti-alert-circle",   color:"text-[#EF9F27]", bg:"bg-[#1A1400]", border:"border-[#3D2E00]" },
  info:     { icon:"ti-info-circle",    color:"text-[#6B7280]", bg:"bg-[#161B26]", border:"border-[#2D3748]" },
  success:  { icon:"ti-check-circle",   color:"text-[#1D9E75]", bg:"bg-[#001A12]", border:"border-[#0F3D28]" },
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) return null;
  const userId  = session.user.id;
  const orgId   = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "notifications", session.user.role);
  if (!canView(__perm)) redirect("/");

  const all = await db.query.notifications.findMany({
    where:   and(eq(notifications.userId, userId), eq(notifications.organizationId, orgId)),
    orderBy: [desc(notifications.createdAt)],
    limit:   50,
  });

  const unread = all.filter(n => !n.isRead);
  const read   = all.filter(n =>  n.isRead);

  function Group({ title, items }: { title:string; items:typeof all }) {
    return items.length === 0 ? null : (
      <div className="space-y-2">
        <h2 className="text-xs font-medium text-[#4B5563] px-1">{title}</h2>
        {items.map(n => {
          const s = TYPE_STYLE[n.type] ?? TYPE_STYLE.info;
          const inner = (
            <div className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${!n.isRead ? `${s.bg} ${s.border}` : "bg-[#0F1117] border-[#1F2937]"} hover:border-[#2D3748]`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${!n.isRead ? "bg-[#0F1117]" : "bg-[#161B26]"}`}>
                <i className={`ti ${s.icon} text-[16px] ${s.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className={`text-sm font-medium ${!n.isRead ? "text-white" : "text-[#6B7280]"}`}>
                    {n.titleAr ?? n.title}
                  </p>
                  <span className="text-[10px] text-[#4B5563] shrink-0">
                    {new Date(n.createdAt).toLocaleDateString("ar", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-[#4B5563] mt-1">{n.body}</p>
              </div>
              {!n.isRead && <div className="w-2 h-2 bg-[#0F6E56] rounded-full mt-1.5 shrink-0" />}
            </div>
          );
          return n.link
            ? <Link key={n.id} href={n.link}>{inner}</Link>
            : <div key={n.id}>{inner}</div>;
        })}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <i className="ti ti-bell text-[#0F6E56]" />الإشعارات
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">{unread.length} غير مقروء · {all.length} إجمالاً</p>
        </div>
        {unread.length > 0 && (
          <form action="/api/notifications/read-all" method="POST">
            <button type="submit"
              className="text-xs text-[#0F6E56] hover:text-[#1D9E75] border border-[#0F3D28] bg-[#001A12] px-3 py-1.5 rounded-lg transition-all">
              <i className="ti ti-checks ml-1" />قراءة الكل
            </button>
          </form>
        )}
      </div>

      {all.length === 0 ? (
        <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-14 text-center">
          <i className="ti ti-bell-off text-[48px] text-[#2D3748]" />
          <p className="text-sm text-[#4B5563] mt-3">لا توجد إشعارات</p>
        </div>
      ) : (
        <>
          <Group title="غير مقروء" items={unread} />
          <Group title="مقروء"      items={read}   />
        </>
      )}
    </div>
  );
}

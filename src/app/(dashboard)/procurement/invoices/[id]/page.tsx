import { auth }     from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { db }       from "@/db";
import { vendorInvoices } from "@/db/schema";
import { eq }       from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import ThreeWayMatchPanel from "@/modules/procurement/components/ThreeWayMatchPanel";
import ChatterBox    from "@/components/shared/ChatterBox";

export default async function InvoiceDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session?.user) notFound();
  const orgId   = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "procurement", session.user.role);
  if (!canView(__perm)) redirect("/");
  const userId  = session.user.id;

  const invoice = await db.query.vendorInvoices.findFirst({
    where: eq(vendorInvoices.id, params.id),
    with: { vendor: true },
  });
  if (!invoice || invoice.organizationId !== orgId) notFound();

  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const MATCH_BADGE: Record<string,string> = {
    pending:     "bg-[#161B26] text-[#4B5563] border-[#2D3748]",
    matched:     "bg-[#001A12] text-[#1D9E75] border-[#0F3D28]",
    discrepancy: "bg-[#2A1215] text-[#E24B4A] border-[#4A1C20]",
    overridden:  "bg-[#0A1628] text-[#378ADD] border-[#1A3060]",
  };
  const MATCH_LABEL: Record<string,string> = {
    pending:"في الانتظار", matched:"مطابقة كاملة",
    discrepancy:"تعارض", overridden:"تم التجاوز",
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono text-[#4B5563] bg-[#161B26] px-2 py-0.5 rounded-md">
              {invoice.vendorInvoiceNo}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${MATCH_BADGE[invoice.matchingStatus ?? "pending"]}`}>
              {MATCH_LABEL[invoice.matchingStatus ?? "pending"]}
            </span>
            {(invoice.matchingStatus === "discrepancy") && (
              <span className="text-xs bg-[#2A1215] text-[#E24B4A] border border-[#4A1C20] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                <i className="ti ti-lock text-[11px]" />محجوب من الدفع
              </span>
            )}
          </div>
          <h1 className="text-xl font-semibold text-white">فاتورة — {invoice.vendor?.name ?? "مورد"}</h1>
        </div>
        <div className="text-left">
          <p className="text-2xl font-bold tabular-nums text-white">{fmt(Number(invoice.totalAmount))}</p>
          <p className="text-xs text-[#4B5563] mt-0.5">USD</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* لوحة المطابقة الثلاثية */}
          <ThreeWayMatchPanel
            invoiceId={invoice.id}
            userId={userId}
            initialResult={null}
          />
          <ChatterBox tableName="vendor_invoices" recordId={invoice.id} organizationId={orgId} userId={userId} />
        </div>

        <div className="space-y-4">
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <i className="ti ti-receipt text-[#0F6E56]" />تفاصيل الفاتورة
            </h2>
            {[
              { label:"رقم الفاتورة",  value: invoice.vendorInvoiceNo },
              { label:"تاريخ الفاتورة",value: new Date(invoice.invoiceDate).toLocaleDateString("ar") },
              { label:"تاريخ الاستحقاق",value: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("ar") : "—" },
              { label:"المبلغ",        value: `${fmt(Number(invoice.totalAmount))} USD` },
              { label:"الحالة",        value: invoice.status },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-1.5 border-b border-[#1F2937] last:border-0">
                <span className="text-xs text-[#4B5563]">{label}</span>
                <span className="text-xs font-medium text-[#D1D5DB]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

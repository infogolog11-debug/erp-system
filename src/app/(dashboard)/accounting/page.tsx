// src/app/(dashboard)/accounting/page.tsx
import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { journalEntries, accounts } from "@/db/schema";
import { eq, and, sum, desc, sql } from "drizzle-orm";
import JournalList      from "@/modules/accounting/components/JournalList";
import AccountingHeader from "@/modules/accounting/components/AccountingHeader";
import FinancialSummary from "@/modules/accounting/components/FinancialSummary";
import PaginationBar from "@/components/shared/PaginationBar";
import { parsePagination } from "@/lib/pagination/parse";

export default async function AccountingPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ tab?:string; page?:string }> }) {
  const searchParams = await searchParamsPromise;
  const session = await auth();
  if (!session?.user) return null;
  const orgId   = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "accounting", session.user.role);
  if (!canView(__perm)) redirect("/");
  const tab     = searchParams.tab ?? "journal";

  // إصلاح (بند "51 findMany غير مُراجَع"): كانت قيود اليومية مقيَّدة بـlimit:50
  // ثابت بلا أي pagination حقيقي — أي قيد أقدم من الخمسين الأحدث كان غير
  // قابل للوصول إطلاقاً من هذه الصفحة. القيود المحاسبية تتراكم بلا توقف عبر
  // السنوات المالية، فهذا نفس فئة الخطر (نمو غير محدود) رغم وجود limit ظاهري.
  const journalWhere = and(eq(journalEntries.organizationId, orgId), eq(journalEntries.isArchived, false));
  const { limit, offset, page } = parsePagination(searchParams);

  const [entries, allAccounts, totalRow] = await Promise.all([
    db.query.journalEntries.findMany({
      where: journalWhere,
      orderBy: [desc(journalEntries.entryDate)],
      limit: limit + 1,
      offset,
    }),
    db.query.accounts.findMany({
      where: and(eq(accounts.organizationId, orgId), eq(accounts.isActive, true)),
      orderBy: (t, { asc }) => [asc(t.code)],
    }),
    db.select({ c: sql<number>`count(*)` }).from(journalEntries).where(journalWhere),
  ]);

  const hasNextPage = entries.length > limit;
  const visibleEntries = hasNextPage ? entries.slice(0, limit) : entries;
  const totalCount = Number(totalRow[0]?.c ?? 0);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <AccountingHeader role={session.user.role} tab={tab} />
      <FinancialSummary accounts={allAccounts} />
      {tab === "accounts"
        ? <AccountsList accounts={allAccounts} />
        : <>
            <JournalList entries={visibleEntries} role={session.user.role} userId={session.user.id} organizationId={orgId} />
            <PaginationBar basePath="/accounting" currentPage={page} hasNextPage={hasNextPage} totalCount={totalCount} pageSize={limit} />
          </>
      }
    </div>
  );
}

import type { AccountDisplay } from "@/types/db";

function AccountsList({ accounts }: { accounts: AccountDisplay[] }) {
  const TYPE_LABEL: Record<string,string> = { asset:"أصول", liability:"خصوم", equity:"حقوق الملكية", revenue:"إيرادات", expense:"مصروفات" };
  const TYPE_COLOR: Record<string,string> = { asset:"#378ADD", liability:"#E24B4A", equity:"#7F77DD", revenue:"#1D9E75", expense:"#EF9F27" };
  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1F2937]">
            {["الكود","اسم الحساب","النوع","الرصيد الحالي"].map(h=>(
              <th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.map((acc, i) => {
            const bal = Number(acc.currentBalance);
            return (
              <tr key={acc.id} className={`hover:bg-[#161B26] ${i < accounts.length-1 ? "border-b border-[#1F2937]" : ""}`}>
                <td className="px-4 py-3 font-mono text-xs text-[#4B5563]">{acc.code}</td>
                <td className="px-4 py-3 font-medium text-[#D1D5DB]">{acc.name}</td>
                <td className="px-4 py-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ background:`${TYPE_COLOR[acc.accountType]}15`, color:TYPE_COLOR[acc.accountType] }}>
                    {TYPE_LABEL[acc.accountType]}
                  </span>
                </td>
                <td className={`px-4 py-3 font-semibold tabular-nums ${bal >= 0 ? "text-[#1D9E75]" : "text-[#E24B4A]"}`}>
                  {bal.toLocaleString("ar-SA")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

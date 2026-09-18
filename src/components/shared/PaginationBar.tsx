import Link from "next/link";

// شريط ترقيم صفحات بسيط (روابط ?page=N)، بدون حالة عميل — يعمل مع Server
// Components مباشرة بدون أي JS إضافي على المتصفح.
export default function PaginationBar({
  basePath,
  currentPage,
  hasNextPage,
  totalCount,
  pageSize,
  extraParams = {},
}: {
  basePath: string;
  currentPage: number;
  hasNextPage: boolean;
  totalCount?: number;
  pageSize: number;
  extraParams?: Record<string, string | undefined>;
}) {
  const buildHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(extraParams)) if (v) params.set(k, v);
    params.set("page", String(page));
    return `${basePath}?${params.toString()}`;
  };

  if (currentPage === 1 && !hasNextPage) return null; // صفحة وحيدة، ما فيها داعي لشريط

  return (
    <div className="flex items-center justify-between border-t pt-4 mt-4 text-sm text-gray-600">
      <div>
        {typeof totalCount === "number"
          ? `عرض ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalCount)} من ${totalCount}`
          : `صفحة ${currentPage}`}
      </div>
      <div className="flex gap-2">
        {currentPage > 1 && (
          <Link href={buildHref(currentPage - 1)} className="px-3 py-1 rounded border hover:bg-gray-50">السابق</Link>
        )}
        {hasNextPage && (
          <Link href={buildHref(currentPage + 1)} className="px-3 py-1 rounded border hover:bg-gray-50">التالي</Link>
        )}
      </div>
    </div>
  );
}

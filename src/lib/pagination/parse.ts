// ════════════════════════════════════════════════════════════════
// أداة pagination موحّدة لصفحات القوائم (Server Components). كانت
// أغلب صفحات القوائم (vendors, grants, procurement, fleet...) تجلب
// السجلات كاملة بدون limit — بمراجعة لاحقة تبيّن هذا أخطر بكثير مما
// بدا أول مرة: **59 استدعاء findMany داخل ملفات page.tsx**، مو 22 فقط
// كما ظهر بفحص أولي اقتصر على actions.ts/lib. أغلب الـ 22 الأولى طلعت
// عند الفحص التفصيلي مقيّدة أصلاً بمفتاح عمل طبيعي (منحة واحدة، أمر شراء
// واحد، مرحلة موافقة واحدة) فحجمها محدود بغض النظر عن حجم الجدول — لكن
// صفحات القوائم الفعلية (vendors/grants/procurement/fleet وغيرها) بدون
// أي قيد كهذا، وهي المخاطر الحقيقية بالحجم.
// ════════════════════════════════════════════════════════════════
export const DEFAULT_PAGE_SIZE = 50;

export function parsePagination(
  searchParams: Record<string, string | string[] | undefined>,
  pageSize = DEFAULT_PAGE_SIZE,
): { limit: number; offset: number; page: number } {
  const raw = searchParams.page;
  const pageStr = Array.isArray(raw) ? raw[0] : raw;
  const page = Math.max(1, Number.parseInt(pageStr ?? "1", 10) || 1);
  return { limit: pageSize, offset: (page - 1) * pageSize, page };
}

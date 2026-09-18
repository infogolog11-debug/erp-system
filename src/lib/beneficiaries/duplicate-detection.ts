// كشف الازدواجية — يُبنى hash طبيعي من (الاسم الكامل + تاريخ الميلاد + رقم الهوية)
// بعد تطبيع النص (إزالة المسافات الزائدة، توحيد الحالة، إزالة التشكيل العربي البسيط)
// يُستخدم لمطابقة سريعة عبر فهرس DB بدل مقارنة نصية بطيئة لكل تسجيل جديد.

function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")   // إزالة التشكيل العربي
    .replace(/[إأآا]/g, "ا")                  // توحيد الألف
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

export function buildDuplicateCheckHash(input: {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  nationalId?: string | null;
}): string {
  const parts = [
    normalize(input.firstName),
    normalize(input.lastName),
    normalize(input.dateOfBirth ?? ""),
    normalize(input.nationalId ?? ""),
  ];
  // hash بسيط مستقر (غير تشفيري) — كافٍ للفهرسة والمطابقة، وليس للأمان
  const raw = parts.join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return `${hash.toString(16)}_${raw.length}`;
}

// درجة تشابه بسيطة بين مستفيدَين محتملَين (0-100) لعرضها للمستخدم عند المراجعة اليدوية
export function similarityScore(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  const shorter = na.length < nb.length ? na : nb;
  const longer  = na.length < nb.length ? nb : na;
  if (longer.includes(shorter)) return 80;
  // تشابه تقريبي بعدد الأحرف المشتركة
  const setA = new Set(na.split(""));
  const setB = new Set(nb.split(""));
  const inter = [...setA].filter(c => setB.has(c)).length;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? Math.round((inter/union)*100) : 0;
}

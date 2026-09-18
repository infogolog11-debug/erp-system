// ════════════════════════════════════════
// STATE MACHINE — منطق انتقال الحالات
// ════════════════════════════════════════
export type RecordStatus = "draft"|"submitted"|"approved"|"rejected"|"done"|"cancelled";

// الانتقالات المسموح بها لكل وحدة
export const ALLOWED_TRANSITIONS: Record<string,Record<RecordStatus,RecordStatus[]>> = {
  procurement: {
    draft:     ["submitted","cancelled"],
    submitted: ["approved","rejected","draft"],
    approved:  ["done","cancelled"],
    rejected:  ["draft"],
    done:      [],
    cancelled: [],
  },
  grants: {
    draft:     ["submitted","cancelled"],
    submitted: ["approved","rejected"],
    approved:  ["done"],
    rejected:  ["draft"],
    done:      [],
    cancelled: [],
  },
  hr: {
    draft:     ["submitted","cancelled"],
    submitted: ["approved","rejected"],
    approved:  ["done"],
    rejected:  ["draft"],
    done:      [],
    cancelled: [],
  },
};

export function canTransition(
  module: string,
  from: RecordStatus,
  to: RecordStatus
): boolean {
  return ALLOWED_TRANSITIONS[module]?.[from]?.includes(to) ?? false;
}

// src/modules/hr/components/AttendanceLeavePanel.tsx
// واجهات إدخال الحضور وتقديم/اعتماد الإجازات — كانت جداول attendance
// و leave_requests تُقرأ وتُعرض فقط رغم أن مسير الرواتب يعتمد عليها.
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordAttendance, createLeaveRequest, setLeaveRequestDecision } from "@/modules/hr/actions";
import type { AppLocale } from "@/lib/preferences";
import { commonCopy } from "@/lib/i18n";

type LeaveItem = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: string | null;
  status: string;
};

type Props = {
  employeeId: string;
  organizationId: string;
  userId: string;
  locale?: AppLocale;
  canApprove: boolean;
  leaves: LeaveItem[];
};

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] focus:ring-1 focus:ring-[#0F6E56] transition-all";

const today = () => new Date().toISOString().slice(0, 10);

export default function AttendanceLeavePanel({
  employeeId, organizationId, userId, locale = "ar", canApprove, leaves,
}: Props) {
  const router = useRouter();
  const common = commonCopy[locale];
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [att, setAtt] = useState({
    workDate: today(), attendanceType: "present", checkIn: "", checkOut: "", overtimeHours: "",
  });
  const [lv, setLv] = useState({ leaveType: "annual", startDate: today(), endDate: today(), reason: "" });

  const t = locale === "ar"
    ? {
        recordAttendance: "تسجيل حضور",
        workDate: "التاريخ", type: "النوع",
        present: "حاضر", absent: "غائب", halfDay: "نصف يوم", remote: "عن بُعد",
        checkIn: "الحضور", checkOut: "الانصراف", overtime: "ساعات إضافية",
        save: "حفظ", newLeave: "طلب إجازة",
        leaveType: "نوع الإجازة",
        annual: "سنوية", sick: "مرضية", maternity: "أمومة", paternity: "أبوة", unpaid: "بدون راتب", emergency: "طارئة",
        startDate: "من", endDate: "إلى", reason: "السبب",
        submit: "تقديم الطلب", approve: "اعتماد", reject: "رفض",
        saved: "تم الحفظ بنجاح",
        recentLeaves: "الإجازات",
        approved: "معتمد", rejected: "مرفوض", pending: "معلق",
      }
    : {
        recordAttendance: "Record attendance",
        workDate: "Date", type: "Type",
        present: "Present", absent: "Absent", halfDay: "Half day", remote: "Remote",
        checkIn: "Check in", checkOut: "Check out", overtime: "Overtime hours",
        save: "Save", newLeave: "Leave request",
        leaveType: "Leave type",
        annual: "Annual", sick: "Sick", maternity: "Maternity", paternity: "Paternity", unpaid: "Unpaid", emergency: "Emergency",
        startDate: "From", endDate: "To", reason: "Reason",
        submit: "Submit request", approve: "Approve", reject: "Reject",
        saved: "Saved successfully",
        recentLeaves: "Leaves",
        approved: "Approved", rejected: "Rejected", pending: "Pending",
      };

  const attTypes: { value: string; label: string }[] = [
    { value: "present", label: t.present },
    { value: "absent", label: t.absent },
    { value: "half_day", label: t.halfDay },
    { value: "remote", label: t.remote },
  ];
  const leaveTypes: { value: string; label: string }[] = [
    { value: "annual", label: t.annual },
    { value: "sick", label: t.sick },
    { value: "maternity", label: t.maternity },
    { value: "paternity", label: t.paternity },
    { value: "unpaid", label: t.unpaid },
    { value: "emergency", label: t.emergency },
  ];
  const typeLabel = (v: string) => leaveTypes.find(x => x.value === v)?.label ?? v;

  const fmtDate = (s: string) => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(locale === "ar" ? "ar" : "en-US");
  };

  function submitAttendance(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setNotice("");
    startTransition(async () => {
      const res = await recordAttendance({
        organizationId,
        employeeId,
        workDate: att.workDate,
        attendanceType: att.attendanceType as "present" | "absent" | "half_day" | "remote",
        checkIn:  att.checkIn  ? `${att.workDate}T${att.checkIn}:00`  : undefined,
        checkOut: att.checkOut ? `${att.workDate}T${att.checkOut}:00` : undefined,
        overtimeHours: att.overtimeHours === "" ? undefined : Number(att.overtimeHours),
      }, userId);
      if (res.success) { setNotice(t.saved); router.refresh(); }
      else setError(res.error);
    });
  }

  function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setNotice("");
    startTransition(async () => {
      const res = await createLeaveRequest({
        organizationId, employeeId,
        leaveType: lv.leaveType as "annual" | "sick" | "maternity" | "paternity" | "unpaid" | "emergency",
        startDate: lv.startDate, endDate: lv.endDate,
        reason: lv.reason || undefined,
      }, userId);
      if (res.success) { setNotice(t.saved); router.refresh(); }
      else setError(res.error);
    });
  }

  function decide(id: string, decision: "approved" | "rejected") {
    setError(""); setNotice("");
    startTransition(async () => {
      const res = await setLeaveRequestDecision(id, organizationId, userId, decision);
      if (res.success) { setNotice(t.saved); router.refresh(); }
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 bg-[#2A1215] border border-[#4A1C20] rounded-xl px-4 py-3 text-sm text-[#E24B4A]">
          <i className="ti ti-alert-circle" />{error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 bg-[#001A12] border border-[#0F3D28] rounded-xl px-4 py-3 text-sm text-[#1D9E75]">
          <i className="ti ti-circle-check" />{notice}
        </div>
      )}

      {/* تسجيل الحضور */}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <i className="ti ti-clock-check text-[#378ADD]" />{t.recordAttendance}
        </h2>
        <form onSubmit={submitAttendance} className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{t.workDate}</label>
            <input type="date" value={att.workDate} onChange={e => setAtt(p => ({ ...p, workDate: e.target.value }))} className={inputCls} required dir="ltr" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{t.type}</label>
            <select value={att.attendanceType} onChange={e => setAtt(p => ({ ...p, attendanceType: e.target.value }))} className={inputCls + " cursor-pointer"}>
              {attTypes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{t.overtime}</label>
            <input type="number" min="0" max="24" step="0.5" value={att.overtimeHours} onChange={e => setAtt(p => ({ ...p, overtimeHours: e.target.value }))} className={inputCls} placeholder="0" dir="ltr" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{t.checkIn}</label>
            <input type="time" value={att.checkIn} onChange={e => setAtt(p => ({ ...p, checkIn: e.target.value }))} className={inputCls} dir="ltr" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{t.checkOut}</label>
            <input type="time" value={att.checkOut} onChange={e => setAtt(p => ({ ...p, checkOut: e.target.value }))} className={inputCls} dir="ltr" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={isPending} className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all">
              <i className="ti ti-device-floppy" />{t.save}
            </button>
          </div>
        </form>
      </div>

      {/* طلب إجازة */}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <i className="ti ti-beach text-[#A855F7]" />{t.newLeave}
        </h2>
        <form onSubmit={submitLeave} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{t.leaveType}</label>
            <select value={lv.leaveType} onChange={e => setLv(p => ({ ...p, leaveType: e.target.value }))} className={inputCls + " cursor-pointer"}>
              {leaveTypes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{t.startDate}</label>
            <input type="date" value={lv.startDate} onChange={e => setLv(p => ({ ...p, startDate: e.target.value }))} className={inputCls} required dir="ltr" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{t.endDate}</label>
            <input type="date" value={lv.endDate} onChange={e => setLv(p => ({ ...p, endDate: e.target.value }))} className={inputCls} required dir="ltr" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={isPending} className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all">
              <i className="ti ti-send" />{t.submit}
            </button>
          </div>
          <div className="col-span-2 lg:col-span-4">
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{t.reason}</label>
            <input value={lv.reason} onChange={e => setLv(p => ({ ...p, reason: e.target.value }))} className={inputCls} />
          </div>
        </form>

        {leaves.length > 0 && (
          <div className="mt-5 pt-4 border-t border-[#1F2937] space-y-2">
            <h3 className="text-xs font-semibold text-[#9CA3AF]">{t.recentLeaves}</h3>
            {leaves.map(l => (
              <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-[#1F2937] last:border-0">
                <div>
                  <p className="text-xs text-[#D1D5DB]">{typeLabel(l.leaveType)}</p>
                  <p className="text-[10px] text-[#4B5563]">{fmtDate(l.startDate)} — {fmtDate(l.endDate)} · {l.totalDays ?? "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    l.status === "approved" ? "bg-[#001A12] text-[#1D9E75]" :
                    l.status === "rejected" ? "bg-[#2A1215] text-[#E24B4A]" :
                    "bg-[#1A1400] text-[#EF9F27]"
                  }`}>{l.status === "approved" ? t.approved : l.status === "rejected" ? t.rejected : t.pending}</span>
                  {canApprove && l.status === "submitted" && (
                    <>
                      <button type="button" disabled={isPending} onClick={() => decide(l.id, "approved")} className="text-[10px] px-2 py-0.5 rounded-full bg-[#001A12] text-[#1D9E75] border border-[#0F3D28] hover:bg-[#002818] transition-all">{t.approve}</button>
                      <button type="button" disabled={isPending} onClick={() => decide(l.id, "rejected")} className="text-[10px] px-2 py-0.5 rounded-full bg-[#2A1215] text-[#E24B4A] border border-[#4A1C20] hover:bg-[#3A171B] transition-all">{t.reject}</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

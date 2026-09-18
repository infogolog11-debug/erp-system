"use client";
import { useState, useTransition } from "react";
import Link from "next/link";

type Notif = { id:string; title:string; titleAr?:string|null; body:string; type:string; link?:string|null; isRead:boolean; createdAt:string };
type Props = { notifications: Notif[]; unreadCount: number };

const TYPE_STYLE: Record<string,{ icon:string; color:string }> = {
  approval: { icon:"ti-shield-check",   color:"text-[#378ADD]"  },
  alert:    { icon:"ti-alert-triangle", color:"text-[#E24B4A]"  },
  warning:  { icon:"ti-alert-circle",   color:"text-[#EF9F27]"  },
  info:     { icon:"ti-info-circle",    color:"text-[#6B7280]"  },
  success:  { icon:"ti-check-circle",   color:"text-[#1D9E75]"  },
};

export default function NotificationBell({ notifications, unreadCount }: Props) {
  const [open, setOpen]       = useState(false);
  const [items, setItems]     = useState(notifications);
  const [isPending, start]    = useTransition();

  function markRead(id: string) {
    start(async () => {
      await fetch(`/api/notifications/${id}/read`, { method:"POST" });
      setItems(p => p.map(n => n.id === id ? { ...n, isRead:true } : n));
    });
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method:"POST" });
    setItems(p => p.map(n => ({ ...n, isRead:true })));
  }

  const unread = items.filter(n => !n.isRead).length;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#161B26] transition-all">
        <i className="ti ti-bell text-[18px] text-[#9CA3AF]" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-[#E24B4A] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-20 w-80 bg-[#0F1117] border border-[#1F2937] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1F2937]">
              <span className="text-sm font-semibold text-white">الإشعارات</span>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-[11px] text-[#0F6E56] hover:text-[#1D9E75]">
                    قراءة الكل
                  </button>
                )}
                <Link href="/notifications" className="text-[11px] text-[#4B5563] hover:text-[#9CA3AF]" onClick={() => setOpen(false)}>
                  عرض الكل
                </Link>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-[#1F2937]">
              {items.length === 0 ? (
                <div className="py-10 text-center">
                  <i className="ti ti-bell-off text-[32px] text-[#2D3748]" />
                  <p className="text-xs text-[#4B5563] mt-2">لا توجد إشعارات</p>
                </div>
              ) : items.slice(0,8).map(n => {
                const s = TYPE_STYLE[n.type] ?? TYPE_STYLE.info;
                const inner = (
                  <div key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-[#161B26] transition-colors cursor-pointer ${!n.isRead?"bg-[#0A0F15]":""}`}
                    onClick={() => { if(!n.isRead) markRead(n.id); if(n.link) setOpen(false); }}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${!n.isRead?"bg-[#161B26]":"bg-[#0F1117]"}`}>
                      <i className={`ti ${s.icon} text-[13px] ${s.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${!n.isRead?"text-white":"text-[#9CA3AF]"}`}>
                        {n.titleAr ?? n.title}
                      </p>
                      <p className="text-[10px] text-[#4B5563] mt-0.5 truncate">{n.body}</p>
                      <p className="text-[10px] text-[#2D3748] mt-0.5">
                        {new Date(n.createdAt).toLocaleDateString("ar")}
                      </p>
                    </div>
                    {!n.isRead && <div className="w-1.5 h-1.5 bg-[#0F6E56] rounded-full mt-1.5 shrink-0" />}
                  </div>
                );
                return n.link ? <Link key={n.id} href={n.link}>{inner}</Link> : inner;
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

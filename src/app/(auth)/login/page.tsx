// src/app/(auth)/login/page.tsx
"use client";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await signIn("credentials", {
        email, password, redirect: false,
      });
      if (res?.error) {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      } else {
        router.push("/");
        router.refresh();
      }
    });
  }

  return (
    <div className="min-h-screen bg-[#0F1117] flex items-center justify-center p-4" dir="rtl">

      {/* خلفية هندسية خفية */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#1B4332] opacity-20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-[#064E3B] opacity-15 rounded-full blur-[80px]" />
      </div>

      <div className="relative w-full max-w-[400px]">

        {/* الشعار */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0F6E56] mb-5 shadow-lg shadow-[#0F6E56]/30">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M4 20L14 4L24 20H4Z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M8 20h12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="14" cy="14" r="2" fill="white"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">نظام الإدارة</h1>
          <p className="text-sm text-[#6B7280] mt-1.5">سجّل دخولك للمتابعة</p>
        </div>

        {/* البطاقة */}
        <div className="bg-[#161B26] border border-[#1F2937] rounded-2xl p-8 shadow-2xl">

          {error && (
            <div className="mb-5 flex items-center gap-2.5 bg-[#2A1215] border border-[#4A1C20] rounded-xl px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                <circle cx="8" cy="8" r="7" stroke="#E24B4A" strokeWidth="1.5"/>
                <path d="M8 5v3.5" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.75" fill="#E24B4A"/>
              </svg>
              <span className="text-[#E24B4A] text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="block text-sm text-[#9CA3AF] mb-2 font-medium">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.com"
                required
                className="w-full bg-[#0F1117] border border-[#2D3748] rounded-xl px-4 py-3 text-white text-sm placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] focus:ring-1 focus:ring-[#0F6E56] transition-all"
                dir="ltr"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm text-[#9CA3AF] font-medium">
                  كلمة المرور
                </label>
                <button type="button" className="text-xs text-[#0F6E56] hover:text-[#1D9E75] transition-colors">
                  نسيت كلمة المرور؟
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#0F1117] border border-[#2D3748] rounded-xl px-4 py-3 text-white text-sm placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] focus:ring-1 focus:ring-[#0F6E56] transition-all"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#0F6E56]/20 mt-2"
            >
              {isPending ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.3"/>
                    <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  جارٍ تسجيل الدخول...
                </>
              ) : "تسجيل الدخول"}
            </button>

          </form>

        </div>

        {/* تذييل */}
        <p className="text-center text-xs text-[#374151] mt-6">
          جميع البيانات محمية ومشفرة
        </p>
      </div>
    </div>
  );
}

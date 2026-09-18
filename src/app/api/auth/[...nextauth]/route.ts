// src/app/api/auth/[...nextauth]/route.ts
// نقطة الدخول الرسمية لـ NextAuth v5 بـ App Router.
// بدون هذا الملف: /api/auth/signin, /callback, /session, /csrf, /signout كلها 404.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;

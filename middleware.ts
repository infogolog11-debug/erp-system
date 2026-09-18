// middleware.ts — جذر المشروع (مع src/)
export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|api/health).*)",
  ],
};
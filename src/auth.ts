// src/auth.ts — ضعه في جذر src/
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8 ساعات
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuth     = nextUrl.pathname.startsWith("/login");
      const isApi      = nextUrl.pathname.startsWith("/api/auth");
      if (isApi)  return true;
      if (isAuth) return isLoggedIn ? Response.redirect(new URL("/", nextUrl)) : true;
      return isLoggedIn || false;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id             = user.id as string;
        token.role           = user.role;
        token.organizationId = user.organizationId;
        token.firstName      = user.firstName;
        token.lastName       = user.lastName;
        if (user.email) token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id             = token.id;
        session.user.role           = token.role;
        session.user.organizationId = token.organizationId;
        session.user.firstName      = token.firstName;
        session.user.lastName       = token.lastName;
        if (token.email) session.user.email = token.email;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, _request) {
        const parsed = z.object({
          email:    z.string().email(),
          password: z.string().min(1),
        }).safeParse(credentials);

        if (!parsed.success) return null;

        const rl = checkRateLimit(`login:${parsed.data.email.toLowerCase()}`, { limit: 5, windowMs: 5 * 60_000 });
        if (!rl.allowed) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, parsed.data.email),
        });

        if (!user || !user.isActive || user.isArchived) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        // تحديث آخر تسجيل دخول
        await db.update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id));

        return {
          id:             user.id,
          email:          user.email,
          role:           user.role,
          organizationId: user.organizationId,
          firstName:      user.firstName,
          lastName:       user.lastName,
        };
      },
    }),
  ],
});

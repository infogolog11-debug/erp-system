import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

type UserRole = "super_admin"|"admin"|"finance_manager"|"program_manager"|"hr_manager"|"procurement_officer"|"warehouse_manager"|"viewer";

interface ExtendedUser {
  id:             string;
  role:           UserRole;
  organizationId: string;
  firstName?:     string;
  lastName?:      string;
  nameAr?:        string;
  isActive?:      boolean;
}

declare module "next-auth" {
  interface User extends DefaultUser, ExtendedUser {}
  interface Session {
    user: DefaultSession["user"] & ExtendedUser;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT, ExtendedUser {}
}

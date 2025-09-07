import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    username?: string | null;
    lastLoginAt?: Date | null;
  }

  interface Session {
    user: {
      id: string;
      username?: string | null;
      lastLoginAt?: Date | null;
    } & DefaultSession["user"];
  }
}
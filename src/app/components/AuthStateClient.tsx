"use client";
import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthStateClient() {
  const { data: session, status } = useSession();

  if (status === "loading") return <p className="text-sm text-gray-500">Loading…</p>;

  if (!session) {
    return (
      <button
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        className="px-4 py-2 rounded-full border bg-white hover:bg-gray-100"
      >
        Sign in with Google
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-medium">Hi, {session.user?.name}</p>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-800"
      >
        Sign out
      </button>
    </div>
  );
}
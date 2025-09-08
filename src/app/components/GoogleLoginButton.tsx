"use client";
import { signIn } from "next-auth/react";

export default function GoogleLoginButton() {
  return (
    <button
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      aria-label="Sign in with Google"
      className="mx-auto block flex items-center justify-center gap-3 w-full max-w-xs py-3 px-4 rounded-full border border-gray-300 bg-white hover:bg-gray-100 hover:shadow-md transition-all shadow-sm text-gray-700 font-bold"
    >
      <img src="/google-icon.svg" alt="Google" width={20} height={20} className="shrink-0" />
      <span>Sign in with Google</span>
    </button>
  );
}
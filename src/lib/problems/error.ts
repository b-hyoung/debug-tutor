import { NextResponse } from "next/server";

export const badRequest = (msg: string) =>
  NextResponse.json({ error: msg }, { status: 400 });

export const badGateway = (msg: string, extra?: any) =>
  NextResponse.json({ error: msg, ...(extra ?? {}) }, { status: 502 });

export const serverError = (msg?: string) =>
  NextResponse.json({ error: msg ?? "generate_failed" }, { status: 500 });

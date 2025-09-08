import { Lang, runInDocker } from "@/server/runnner";
import { NextRequest, NextResponse } from "next/server";

// 호출 방법
// fetch("/api/run", { method: "POST", body: JSON.stringify({ language: "c", code, input }) })
// 간단한 레이트 리밋/입력 크기 제한은 프록시(or 미들웨어)에서 추가 권장
export async function POST(req: NextRequest) {
  try {

    const {language,code, input } = await req.json();

    if (!["c", "python"].includes(language)) {
      return NextResponse.json({ error: "unsupported_language" }, { status: 400 });
    }
    if (typeof code !== "string" || code.length > 200_000) {
      return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    }
    if (typeof input !== "string" || input.length > 50_000) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const result = await runInDocker({ language, code, input });
    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "run_failed" }, { status: 500 });
  }
}
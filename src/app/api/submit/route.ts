import { NextRequest, NextResponse } from "next/server";
import { runInDocker } from "@/server/runnner";
type DockerResult =
  | { ok: true; stdout: string; stderr: string; exitCode: number }
  | { ok: false; error: string };

export async function POST(req: NextRequest) {
  try {
    const { language, code, input } = await req.json();

    if (!["c", "python"].includes(language)) {
      return NextResponse.json({ error: "unsupported_language" }, { status: 400 });
    }
    if (typeof code !== "string") {
      return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    }
    
    // input은 선택적이지만, undefined일 경우 빈 문자열로 대체
    const safeInput = typeof input === "string" ? input : "";

    const exec = await runInDocker({ language, code, input: safeInput });

    if (!exec.ok) {
      return NextResponse.json({ error: exec.error }, { status: 500 });
    }

    return NextResponse.json({
      stdout: exec.stdout,
      stderr: (exec as any).stderr ?? "", // 타입 무시 + fallback
      exitCode: (exec as any).exitCode ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "run_failed" }, { status: 500 });
  }
}


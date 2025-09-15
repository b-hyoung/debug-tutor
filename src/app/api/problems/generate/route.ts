// app/api/problems/generate/route.ts
// =========[ API HANDLER ]=========
import { NextRequest, NextResponse } from "next/server";
import { createJsonResponse } from "@/lib/openai";
import { schema, instructions } from "@/lib/problems/schema";
import { parseLLMJson } from "@/lib/problems/json-utils";
import { adaptToProblem } from "@/lib/problems/adapter";
import { runSingleCase } from "@/lib/problems/exec";
import { badRequest, badGateway, serverError } from "@/lib/problems/error";
import { isLang, Lang } from "@/lib/problems/types";

export async function GET(req: NextRequest) {
  try {
    const lang = (new URL(req.url).searchParams.get("language") ?? "python") as Lang;
    if (!isLang(lang)) return badRequest("unsupported_language");

    const llm = await createJsonResponse({
      schemaName: "DebugProblem",
      schema,
      instructions,
      input: [{
        role: "user",
        content: `언어=${lang}, 주제=프로그래머스 스타일 문제.
난이도=중간 이상.
조건:
1) 단순 오름차순 정렬 문제는 금지.
2) 정렬 기준은 최소 2단계 이상(예: 점수 내림차순, 같으면 이름 오름차순).
3) 입력은 stdin에서 받으며, 출력은 stdout에만 해야 함.
4) 입력 포맷은 공백 또는 콤마 등 다양하게 주어질 수 있음.
5) 반드시 의도적인 버그가 포함된 코드(로직 오류 위주)를 생성할 것.
6) expected_output은 정확히 정의할 것. 엣지 케이스(음수, 중복 포함) 최소 1개 이상 포함.
7) "buggy_code" 필드에는 **코드만** 포함하고, 주석/힌트/설명은 절대 넣지 마라.
8) 힌트는 반드시 "hint_levels" 배열 필드에만 단계적으로 제공하라 (ex: ["힌트1", "힌트2", "힌트3"]).
`
      }],
      temperature: 0.7,
      max_output_tokens: 800,
    });

    let parsed: any;
    try { parsed = parseLLMJson(llm); }
    catch { return badGateway("invalid_ai_json", { raw: llm }); }

    const raw = adaptToProblem(parsed, lang);
    if (!raw) return badGateway("invalid_ai_schema", { parsed });

    const tc = await runSingleCase(raw);

    return NextResponse.json({
      title: raw.title,
      language: raw.language,
      buggy_code: raw.buggy_code,
      test_case: tc,
      hint_levels: raw.hint_levels ?? [],
      valid_bug: tc.diff === true,
    });
  } catch (e: any) {
    return serverError(e?.message);
  }
}

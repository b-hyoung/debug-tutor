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
        content: `언어=${lang}, 주제=버블정렬. 케이스는 1개. expected_output은 오름차순. 코드는 stdin에서 읽고 stdout에만 출력.`,
      }],
      temperature: 0.1,
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

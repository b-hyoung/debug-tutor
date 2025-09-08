// lib/problem/adapter.ts
// =========================[ ADAPTER ]=========================
// 다양한 LLM 출력(스키마 문서, example, 느슨한 키)을 단일 표준 모델로 변환.
// ⚠️ 코드가 누락되면 여기서는 기본코드 주입을 하지 않고 null을 반환합니다.
//    (기본 주입은 호출자 쪽에서 일관되게 처리하세요.)

import { RawProblem, RawCase, isProblem, Lang } from "./types";

// ---------- 0) 공통 헬퍼 ----------
const pickStr = (...cands: any[]): string | null =>
  cands.find((s) => typeof s === "string" && s.trim().length > 0) ?? null;

const asCase = (x: any): RawCase | null =>
  x && typeof x.input === "string" && typeof x.expected_output === "string"
    ? { name: x.name && typeof x.name === "string" ? x.name : "case_1", input: x.input, expected_output: x.expected_output }
    : null;

// ---------- 1) 어댑터 본체 ----------
export function adaptToProblem(parsed: any, language: Lang): RawProblem | null {
  // (A) 스키마 문서 형태 엄격 매칭: { type:"object", example: {...} } 또는 properties.code.examples[0]
  const hasSchemaExample =
    !!(parsed?.example && (parsed?.example?.buggy_code || parsed?.example?.code)) ||
    (Array.isArray(parsed?.properties?.code?.examples) && parsed.properties.code.examples.length > 0);

  if (parsed && parsed.type === "object" && hasSchemaExample) {
    const ex = parsed.example ?? {};

    const code = pickStr(
      ex.buggy_code,
      ex.code,
      parsed?.properties?.code?.examples?.[0],
      parsed?.problem?.buggy_code, // 혼합 출력 방어
      parsed?.problem?.code
    );
    if (!code) return null;

    const input =
      pickStr(ex.input, ex.test_case) ?? "3 2 1";

    const expected =
      pickStr(ex.expected_output, ex.output) ?? "1 2 3";

    const raw: RawProblem = {
      title: pickStr(parsed.title) ?? "버그 포함 버블 정렬 문제",
      language,
      buggy_code: code,
      test_case: { name: "case_1", input, expected_output: expected },
      hint_levels: Array.isArray(parsed?.hint_levels) ? parsed.hint_levels : undefined,
    };
    return isProblem(raw) ? raw : null;
  }

  // (B) 느슨한 키 형태: { problem? {...} } 또는 루트에 code/test_case/input/expected_output 등
  const P = parsed?.problem ?? parsed ?? {};

  const buggy_code = pickStr(
    P.buggy_code,
    P.code,
    parsed?.buggy_code, // 루트 혼합 방어
    parsed?.code
  );
  if (!buggy_code) return null;

  let tc: RawCase | null = null;

  if (P.test_case && typeof P.test_case === "object") {
    tc = asCase(P.test_case);
  } else if (typeof P.test_case === "string" && (typeof P.expected_output === "string" || typeof P.output === "string")) {
    tc = { name: "case_1", input: P.test_case, expected_output: (P.expected_output ?? P.output) as string };
  } else if (Array.isArray(P.test_cases)) {
    const t = P.test_cases.find(
      (x: any) => typeof x?.input === "string" && (typeof x?.expected_output === "string" || typeof x?.output === "string")
    );
    if (t) tc = { name: t.name && typeof t.name === "string" ? t.name : "case_1", input: t.input, expected_output: (t.expected_output ?? t.output) as string };
  } else if (typeof P.input === "string" && (typeof P.expected_output === "string" || typeof P.output === "string")) {
    tc = { name: "case_1", input: P.input, expected_output: (P.expected_output ?? P.output) as string };
  }

  if (!tc) tc = { name: "case_1", input: "3 2 1", expected_output: "1 2 3" };

  const raw: RawProblem = {
    title: pickStr(P.title) ?? "버그 포함 버블 정렬 문제",
    language,
    buggy_code,
    test_case: tc,
    hint_levels: Array.isArray(P.hint_levels) ? P.hint_levels : undefined,
  };

  return isProblem(raw) ? raw : null;
}

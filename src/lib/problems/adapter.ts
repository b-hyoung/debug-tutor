// lib/problem/adapter.ts
// =========================[ ADAPTER ]=========================
// 다양한 LLM 출력(스키마 문서, example, 느슨한 키)을 단일 표준 모델로 변환.
// 코드가 누락되면 언어별 기본 "버그 포함" 코드로 대체.

import { RawProblem, RawCase, isProblem, Lang } from "./types";

// ---------- 1) 작은 헬퍼 ----------
const asCase = (x: any): RawCase | null =>
  x && typeof x.input === "string" && typeof x.expected_output === "string"
    ? { name: "case_1", input: x.input, expected_output: x.expected_output }
    : null;

function getFallbackBuggyCode(language: Lang): string {
  if (language === "c") {
    // BUG: 마지막 출력 루프가 i <= n (out-of-bounds)
    return `#include <stdio.h>
int main(){ int n; if(scanf("%d",&n)!=1) return 0; int arr[n];
for(int i=0;i<n;i++) scanf("%d",&arr[i]);
for(int i=0;i<n-1;i++){ for(int j=0;j<n-i-1;j++){ if(arr[j]>arr[j+1]){ int t=arr[j]; arr[j]=arr[j+1]; arr[j+1]=t; } } }
for(int i=0;i<=n;i++) printf("%d ",arr[i]); // BUG: <= n
return 0; }`;
  }
  // BUG: 내부 루프 범위 오류 (n-i) → 마지막 비교 누락 가능
  return `import sys
def bubble(a):
    n=len(a)
    for i in range(n):
        for j in range(0, n-i):  # BUG: n-i-1 이어야 안전
            if j+1<n and a[j]>a[j+1]:
                a[j],a[j+1]=a[j+1],a[j]
    return a
arr=list(map(int, sys.stdin.read().strip().split()))
print(*bubble(arr))`;
}

// ---------- 2) 어댑터 본체 ----------
export function adaptToProblem(parsed: any, language: Lang): RawProblem | null {
  // (A) 스키마 문서 형태: { type:"object", example:{...} } 또는 properties.code.examples
  if (parsed && parsed.type === "object") {
    const ex = parsed.example ?? {};
    const codeFromPropsEx =
      typeof parsed?.properties?.code?.examples?.[0] === "string"
        ? parsed.properties.code.examples[0]
        : "";

    const code =
      (typeof ex.buggy_code === "string" && ex.buggy_code) ||
      (typeof ex.code === "string" && ex.code) ||
      codeFromPropsEx ||
      getFallbackBuggyCode(language); // ← 코드 누락 시 기본 버그 코드

    const input =
      (typeof ex.input === "string" && ex.input) ||
      (typeof ex.test_case === "string" && ex.test_case) ||
      "3 2 1";

    const expected =
      (typeof ex.expected_output === "string" && ex.expected_output) ||
      (typeof ex.output === "string" && ex.output) || // 일부 응답은 output 키만 줌
      "1 2 3";

    // (A) 스키마 문서 형태 분기 내부의 title 기본값 교체
    const raw: RawProblem = {
      title: (typeof parsed.title === "string" && parsed.title) || "버그 포함 버블 정렬 문제", // ★ 한국어 기본값
      language,
      buggy_code: code,
      test_case: { name: "case_1", input, expected_output: expected },
      hint_levels: undefined,
    };
    return isProblem(raw) ? raw : null;
  }

  // (B) 느슨한 키: { problem? { ... } } 또는 루트에 code/test_case/input/expected_output 등
  const P = parsed?.problem ?? parsed ?? {};
  const title = typeof P.title === "string" ? P.title : "Untitled";

  const buggy_code =
    (typeof P.buggy_code === "string" && P.buggy_code) ||
    (typeof P.code === "string" && P.code) ||
    getFallbackBuggyCode(language); // ← 코드 누락 시 기본 버그 코드

  let tc: RawCase | null = null;
  if (P.test_case && typeof P.test_case === "object") {
    tc = asCase(P.test_case);
  } else if (typeof P.test_case === "string" && (typeof P.expected_output === "string" || typeof P.output === "string")) {
    tc = { name: "case_1", input: P.test_case, expected_output: (P.expected_output ?? P.output) as string };
  } else if (Array.isArray(P.test_cases)) {
    const t = P.test_cases.find((x: any) => typeof x?.input === "string" && (typeof x?.expected_output === "string" || typeof x?.output === "string"));
    if (t) tc = { name: "case_1", input: t.input, expected_output: (t.expected_output ?? t.output) as string };
  } else if (typeof P.input === "string" && (typeof P.expected_output === "string" || typeof P.output === "string")) {
    tc = { name: "case_1", input: P.input, expected_output: (P.expected_output ?? P.output) as string };
  }

  if (!tc) tc = { name: "case_1", input: "3 2 1", expected_output: "1 2 3" };

  const hint = Array.isArray(P.hint_levels) ? P.hint_levels : undefined;
  const raw: RawProblem = { title, language, buggy_code, test_case: tc, hint_levels: hint };
  return isProblem(raw) ? raw : null;
}

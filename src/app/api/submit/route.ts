import { NextRequest, NextResponse } from "next/server";
import { runInDocker } from "@/server/runnner";

const VALIDATOR_NAMES = ["sort_asc", "reverse", "sum"] as const;
type ValidatorName = typeof VALIDATOR_NAMES[number];

// ---- Local helpers (was '@/server/checks') ----
function parseNumsFlexible(s: string): number[] | null {
  const t = s.trim();
  if (!t) return [];
  // 1) JSON 배열 시도: "[1,2,3]" 또는 "[1, 2, 3]"
  try {
    const v = JSON.parse(t);
    if (Array.isArray(v) && v.every((x) => Number.isFinite(Number(x)))) {
      return v.map((x) => Number(x));
    }
  } catch {}
  // 2) 일반 문자열: 대괄호/콤마/세미콜론을 공백으로 정규화 후 분해
  const cleaned = t.replace(/[\[\],;]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const arr = cleaned.split(" ").map((x) => Number(x));
  return arr.every((n) => Number.isFinite(n)) ? arr : null;
}

function isSortedAsc(nums: number[]): boolean {
  for (let i = 1; i < nums.length; i++) if (nums[i - 1] > nums[i]) return false;
  return true;
}

function sameMultiset(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const m = new Map<number, number>();
  for (const x of a) m.set(x, (m.get(x) ?? 0) + 1);
  for (const y of b) {
    const c = (m.get(y) ?? 0) - 1;
    if (c < 0) return false;
    m.set(y, c);
  }
  return true;
}

/**
 * 이 라우터는 이제 "문제 유형별"로 검증합니다.
 * - problem.validator: "sort_asc" | "reverse" | "sum" | ...
 * - input/output 포맷: 기본은 공백 구분 정수 한 줄 (문제별로 필요 시 변경 가능)
 */

// ---------------- 유틸: 입력 생성기 (대표 케이스 개수/길이 기반 + 추가 엣지) ----------------
function genHiddenCases(
  validator: ValidatorName,
  baseInputs: string[],     // AI 대표 케이스의 입력 배열들
  perBase = 1,              // 대표 케이스 하나당 몇 개 생성할지
  extra = 4                 // 공통 엣지 케이스 몇 개 추가할지
): string[] {
  const out: string[] = [];
  const rnd = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

  // 대표 케이스의 길이를 기준으로 유사 길이의 랜덤 배열 생성
  for (const input of baseInputs) {
    const tokens = input.trim().split(/\s+/).filter(Boolean);
    const baseLen = Math.max(1, tokens.length);

    for (let k = 0; k < perBase; k++) {
      // 길이를 ±2 범위에서 살짝 흔들어 변형 (최소 1)
      const len = Math.max(1, baseLen + rnd(-2, 2));

      if (validator === "sum") {
        // 합 문제는 값 범위를 조금 더 넓힘
        const arr = Array.from({ length: len }, () => rnd(-100, 100));
        out.push(arr.join(" "));
      } else {
        // 정렬/역순 등 일반 배열 문제
        const arr = Array.from({ length: len }, () => rnd(-50, 50));
        // 중복/음수/역패턴이 섞이도록 약간의 확률적 가공
        if (len >= 4 && Math.random() < 0.3) {
          // 일부 구간만 정렬 → 부분 정렬된 배열 생성
          const mid = Math.floor(len / 2);
          const left = arr.slice(0, mid).sort((a, b) => a - b);
          const right = arr.slice(mid);
          out.push(left.concat(right).join(" "));
        } else if (len >= 4 && Math.random() < 0.2) {
          // 역정렬된 배열 생성
          out.push([...arr].sort((a, b) => b - a).join(" "));
        } else {
          out.push(arr.join(" "));
        }
      }
    }
  }

  // 공통 엣지 케이스 추가
  for (let i = 0; i < extra; i++) {
    if (validator === "sum") {
      if (i === 0) out.push("0");                 // 단일 0
      else if (i === 1) out.push("100 -100");     // 합 0
      else {
        const len = rnd(2, 12);
        const arr = Array.from({ length: len }, () => rnd(-100, 100));
        out.push(arr.join(" "));
      }
    } else {
      if (i === 0) out.push("1");                 // 길이1
      else if (i === 1) out.push("2 2 2 2");      // 전부 동일
      else if (i === 2) out.push("5 4 3 2 1");    // 역정렬
      else out.push("-5 -10 0 3");                // 음수 포함
    }
  }

  return out;
}

// ---------------- 유효성 검사기(validator) 레지스트리 ----------------
// 모든 검증기는 (inputStr, outputStr) => boolean 서명으로 통일
const validators: Record<ValidatorName, (input: string, output: string) => boolean> = {
  // 오름차순 정렬 문제: 길이 동일 + 멀티셋 동일 + 오름차순
  sort_asc: (input, output) => {
    const I = parseNumsFlexible(input);
    const O = parseNumsFlexible(output);
    if (!I || !O) return false;
    return I.length === O.length && sameMultiset(I, O) && isSortedAsc(O);
  },
  // 배열 뒤집기 문제: 출력이 정확히 입력을 역순으로 나열
  reverse: (input, output) => {
    const I = parseNumsFlexible(input);
    const O = parseNumsFlexible(output);
    if (!I || !O) return false;
    if (I.length !== O.length) return false;
    for (let i = 0; i < I.length; i++) if (I[i] !== O[O.length - 1 - i]) return false;
    return true;
  },
  // 합계 출력 문제: 출력이 하나의 숫자이며 입력 합과 일치
  sum: (input, output) => {
    const I = parseNumsFlexible(input);
    const O = parseNumsFlexible(output);
    if (!I || !O) return false;
    // 출력은 단일 숫자여야 함
    if (O.length !== 1) return false;
    const s = I.reduce((a, b) => a + b, 0);
    return O[0] === s;
  },
};

// ---------------- 임시 문제 데이터 (실서비스에선 DB에서 로드) ----------------
async function getProblem(problemId: string): Promise<{
  id: string;
  validator: ValidatorName; // "sort_asc" | "reverse" | "sum" | ...
  language_hint?: "c" | "python"; // 선택
  public_cases: { name: string; input: string }[];
  buggy_code?: string;
}> {
  // 데모: problemId로 유형을 분기 (실전에서는 DB 저장값 사용)
  if (problemId === "reverse-demo") {
    return {
      id: problemId,
      validator: "reverse",
      language_hint: "python",
      public_cases: [
        { name: "ex1", input: "1 2 3 4" },
        { name: "ex2", input: "5 -1 5" },
      ],
    };
  }
  if (problemId === "sum-demo") {
    return {
      id: problemId,
      validator: "sum",
      language_hint: "python",
      public_cases: [
        { name: "ex1", input: "1 2 3" },
        { name: "ex2", input: "10 -3" },
      ],
    };
  }
  // 기본: 정렬 문제로
  return {
    id: problemId,
    validator: "sort_asc",
    language_hint: "python",
    public_cases: [
      { name: "case_1", input: "5 3 8 6 2" },
      { name: "case_2", input: "1 4 3" },
    ],
  };
}

export async function POST(req: NextRequest) {
  const { problemId, language, userCode } = await req.json();

  const problem = await getProblem(problemId);
  if (!problem) return NextResponse.json({ error: "problem_not_found" }, { status: 404 });

  const validator = validators[problem.validator] ?? validators["sort_asc"];

  const baseInputs = problem.public_cases.map((c) => c.input);
  const hiddenInputs = genHiddenCases(problem.validator, baseInputs, 2, 4); // 대표 1개당 2개 생성 + 엣지 4개

  // 공개 + 비공개 케이스 구성
  const inputs = [
    ...problem.public_cases.map((c) => ({ name: c.name, input: c.input })),
    ...hiddenInputs.map((s, i) => ({ name: `hidden_${i + 1}`, input: s })),
  ];

  // 제출 코드 실행 및 검증
  const results: { name: string; ok: boolean; actual?: string; error?: string }[] = [];
  for (const tc of inputs) {
    const exec = await runInDocker({ language, code: userCode, input: tc.input });
    if (!exec.ok) {
      results.push({ name: tc.name, ok: false, error: exec.error });
      continue;
    }
    const actual = (exec.stdout ?? "").trim();
    const ok = validator(tc.input, actual);
    results.push({ name: tc.name, ok, actual });
  }

  const pass = results.every((r) => r.ok);

  if (pass) {
    return NextResponse.json({
      pass: true,
      message: "✅ SUCCESS!",
    });
  }

  return NextResponse.json({
    pass: false,
    validator: problem.validator,
    total: results.length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
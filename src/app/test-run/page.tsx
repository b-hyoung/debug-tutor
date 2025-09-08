"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

// CodeMirror (CSR 전용 로딩)
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";

type Lang = "c" | "python";

type GeneratedProblem = {
  title?: string;
  language?: Lang;
  buggy_code?: string;
  test_case?: {
    name?: string;
    input?: string;
    expected_output?: string;
    actual_output?: string | null;
    diff?: boolean;
    error?: string | null;
  };
  hint_levels?: string[];
  valid_bug?: boolean;
};

export default function TestRunPage() {
  // ---------------- 상태 ----------------
  const [language, setLanguage] = useState<Lang>("python");
  const [title, setTitle] = useState<string>("테스트 페이지");
  const [code, setCode] = useState<string>(
    `# 기본 파이썬 코드\na, b = map(int, input().split())\nprint(a+b)`
  );
  const [input, setInput] = useState<string>("5 3");
  const [result, setResult] = useState<null | { ok?: boolean; stdout?: string; error?: string; raw?: any }>(null); // /api/run 결과
  const [loading, setLoading] = useState(false);
  const [gen, setGen] = useState<GeneratedProblem | null>(null); // /api/problems/generate 결과

  // 제출 검증용 상태
  const [problemId, setProblemId] = useState<string>("sort-demo"); // reverse-demo, sum-demo 도 테스트 가능
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<null | {
    pass: boolean;
    validator: string;
    total: number;
    failed: number;
    results: { name: string; ok: boolean; actual?: string; error?: string }[];
  }>(null);
  const isSuccess = submitResult?.pass === true;

  // ---------------- CodeMirror 확장 ----------------
  const codeExtensions = useMemo(
    () => (language === "python" ? [python()] : [cpp()]),
    [language]
  );

  // ---------------- 실행 ----------------
  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, input }),
      });
      const json = await res.json();

      // 안전 파싱: stdout이 JSON 배열 문자열일 수도, 그냥 문자열일 수도 있음
      let normalized: string | undefined = undefined;
      if (typeof json?.stdout === "string") {
        const s = json.stdout.trim();
        try {
          // 예: "[1,2,3]" 형태라면 보기 좋게
          const arr = JSON.parse(s);
          if (Array.isArray(arr)) {
            normalized = `[${arr.join(", ")}]`;
          } else {
            normalized = s;
          }
        } catch {
          normalized = s;
        }
      }

      setResult({ ok: json?.ok, stdout: normalized, error: json?.error, raw: json });
    } catch (e: any) {
      setResult({ error: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  // ---------------- 문제 생성 ----------------
  const generateAndValidate = async () => {
    setLoading(true);
    setGen(null);
    try {
      const res = await fetch(`/api/problems/generate?language=${language}`);
      const raw = await res.text();
      let data: GeneratedProblem | { error: string; raw?: string };
      try {
        data = raw ? (JSON.parse(raw) as GeneratedProblem) : { error: "empty_response" };
      } catch {
        data = { error: "non_json_response", raw } as any;
      }
      if ((data as any).error) {
        setGen(null);
      } else {
        const p = data as GeneratedProblem;
        setGen(p);
      }
    } catch (e: any) {
      setGen(null);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- 제출 검증 (서버 비공개 케이스 포함) ----------------
  const submitForJudge = async () => {
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId, language, userCode: code }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // not JSON (likely HTML error page). Surface it as an error row.
        setSubmitResult({
          pass: false,
          validator: "unknown",
          total: 0,
          failed: 0,
          results: [
            {
              name: `${res.status} ${res.statusText}`,
              ok: false,
              error: text?.slice(0, 500) || "Non-JSON response",
            },
          ],
        });
        return;
      }

      if (!res.ok) {
        setSubmitResult({
          pass: false,
          validator: String(json?.validator ?? "unknown"),
          total: Number(json?.total ?? 0),
          failed: Number(json?.failed ?? 0),
          results: Array.isArray(json?.results) ? json.results : [
            { name: `${res.status} ${res.statusText}`, ok: false, error: JSON.stringify(json).slice(0, 500) }
          ],
        });
        return;
      }

      setSubmitResult(json);
    } catch (e: any) {
      setSubmitResult({ pass: false, validator: "unknown", total: 0, failed: 0, results: [{ name: "network", ok: false, error: String(e?.message || e) }] });
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------- 생성값 적용: title / buggy_code / test_case.input / language ----------------
  useEffect(() => {
    if (!gen) return;
    if (gen.title) setTitle(gen.title);
    if (gen.language && (gen.language === "python" || gen.language === "c")) setLanguage(gen.language);
    if (gen.buggy_code && typeof gen.buggy_code === "string") setCode(gen.buggy_code);
    if (gen.test_case?.input && typeof gen.test_case.input === "string") setInput(gen.test_case.input);
  }, [gen]);

  // ---------------- 파생: 패널 표시용 값 ----------------
  const expectedFromGen: string | null = gen?.test_case?.expected_output ?? null;
  const actualFromGen: string | null =
    gen?.test_case?.actual_output ?? (gen?.test_case?.error ? `ERROR: ${gen.test_case.error}` : null);
  const diffFromGen: boolean | null = typeof gen?.test_case?.diff === "boolean" ? (gen!.test_case!.diff as boolean) : null;
  const hintList: string[] = Array.isArray(gen?.hint_levels) ? (gen!.hint_levels as string[]) : [];

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {isSuccess && (
        <div className="relative">
          {/* Success Banner */}
          <div className="sticky top-0 z-40">
            <div className="mx-auto max-w-6xl px-6">
              <div className="mt-4 rounded-lg bg-emerald-600 text-white shadow-lg ring-1 ring-emerald-700/30">
                <div className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-emerald-600">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-2.1a.75.75 0 1 0-1.22-.9l-3.621 4.912-1.99-1.993a.75.75 0 1 0-1.06 1.061l2.625 2.625a.75.75 0 0 0 1.138-.089l4.128-5.616Z" clipRule="evenodd"/></svg>
                    </span>
                    <div>
                      <div className="font-semibold">성공! 모든 케이스 통과 🎉</div>
                      <div className="text-sm opacity-90">디버깅 센스가 대단해요. 다음 문제로 넘어가 보죠?</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={generateAndValidate}
                      className="rounded bg-white/95 px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm ring-1 ring-inset ring-white/60 hover:bg-white"
                    >
                      다음 문제 생성
                    </button>
                    <button
                      onClick={() => setSubmitResult(null)}
                      className="rounded bg-emerald-700/80 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Confetti */}
          <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
            {Array.from({ length: 90 }).map((_, i) => (
              <span
                key={i}
                className="confetti block h-2 w-2 rounded-sm"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.8}s`,
                  animationDuration: `${2 + Math.random() * 1.8}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}
      <div className="mx-auto max-w-6xl p-6 space-y-6">
        {/* 헤더: 타이틀 + 배지 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{title}</h1>
            {gen?.language && (
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs uppercase shadow-sm">
                {gen.language}
              </span>
            )}
            {typeof gen?.valid_bug === "boolean" && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs shadow-sm ${
                  gen.valid_bug ? "bg-emerald-600 text-white" : "bg-zinc-300 text-zinc-800"
                }`}
              >
                {gen.valid_bug ? "BUG CONFIRMED" : "NO BUG"}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={generateAndValidate}
              disabled={loading}
              className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-50 shadow"
            >
              {loading ? "가져오는 중..." : "문제 생성"}
            </button>
            <button
              onClick={run}
              disabled={loading}
              className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50 shadow"
            >
              {loading ? "실행 중..." : "코드 실행"}
            </button>
            <button
              onClick={submitForJudge}
              disabled={submitting}
              className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50 shadow"
            >
              {submitting ? "검증 중..." : "제출 검증"}
            </button>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-3">
          {/* 좌측: 언어 선택 + 입력값 */}
          <aside className="space-y-4 lg:col-span-1">
            <div>
              <label className="block text-sm font-medium mb-1">문제 ID</label>
              <input
                value={problemId}
                onChange={(e) => setProblemId(e.target.value)}
                className="w-full p-2 border border-zinc-200 rounded text-sm bg-white shadow-sm"
                placeholder="sort-demo | reverse-demo | sum-demo"
              />
              <p className="mt-1 text-[11px] text-zinc-500">/api/submit 검증 시 사용됩니다. (예: sort-demo, reverse-demo, sum-demo)</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">입력값</label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full h-28 p-2 border border-zinc-200 rounded font-mono text-sm bg-white shadow-sm"
                placeholder="공백 구분 정수 한 줄"
              />
            </div>

            {/* 생성 요약 카드 */}
            <div className="rounded border border-zinc-200 p-3 space-y-2 bg-white shadow-sm">
              <div className="text-sm font-semibold">문제 메타</div>
              <div className="text-xs grid grid-cols-2 gap-x-2 gap-y-1">
                <span className="text-zinc-500">언어</span>
                <span>{gen?.language ?? language}</span>
                <span className="text-zinc-500">케이스명</span>
                <span>{gen?.test_case?.name ?? "-"}</span>
                <span className="text-zinc-500">버그 검증</span>
                <span>{gen?.valid_bug ? "다름(OK)" : gen ? "같음" : "-"}</span>
                <span className="text-zinc-500">diff</span>
                <span>{diffFromGen === null ? "-" : diffFromGen ? "true" : "false"}</span>
              </div>
            </div>
          </aside>

          {/* 중앙+우측: 코드 에디터 + 패널 */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">코드</label>
              <div className="rounded border border-zinc-200 overflow-hidden bg-white shadow-sm">
                <CodeMirror
                  value={code}
                  onChange={setCode}
                  height="460px"
                  extensions={codeExtensions}
                  basicSetup={{ lineNumbers: true, foldGutter: true }}
                />
              </div>
            </div>

            {/* 결과 패널: 4열 (실행 결과 / 예상 출력 / 현재 출력 / 상태) */}
            <div className="grid md:grid-cols-4 gap-3">
              <div className="rounded border border-zinc-200 p-3 bg-white shadow-sm">
                <div className="text-sm font-medium mb-1">코드 실행 결과</div>
                <pre className="text-xs overflow-auto min-h-24 bg-zinc-50 rounded p-2">{result?.stdout ?? (result?.error ? `ERROR: ${result.error}` : "실행 결과 없음")}</pre>
              </div>

              <div className="rounded border border-zinc-200 p-3 bg-white shadow-sm">
                <div className="text-sm font-medium mb-1">예상 출력</div>
                <pre className="text-xs overflow-auto min-h-24 bg-zinc-50 rounded p-2">{expectedFromGen ?? "없음"}</pre>
              </div>

              <div className="rounded border border-zinc-200 p-3 bg-white shadow-sm">
                <div className="text-sm font-medium mb-1">현재 출력</div>
                <pre className="text-xs overflow-auto min-h-24 bg-zinc-50 rounded p-2">{actualFromGen ?? "없음"}</pre>
              </div>

              <div className="rounded border border-zinc-200 p-3 bg-white space-y-1 shadow-sm">
                <div className="text-sm font-medium mb-1">상태</div>
                <div className="text-xs">diff: {diffFromGen === null ? "-" : diffFromGen ? "true" : "false"}</div>
                <div className="text-xs">에러: {gen?.test_case?.error ?? "-"}</div>
              </div>
            </div>

            {/* 생성 JSON 원문 + 힌트 */}
            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded border border-zinc-200 p-3 bg-white shadow-sm">
                <div className="text-sm font-medium mb-1">AI 원문(JSON)</div>
                <pre className="text-xs overflow-auto min-h-24 bg-zinc-50 rounded p-2">{gen ? JSON.stringify(gen, null, 2) : "생성 결과 없음"}</pre>
              </div>

              <div className="rounded border border-zinc-200 p-3 bg-white shadow-sm">
                <div className="text-sm font-medium mb-1">힌트</div>
                {hintList.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    {hintList.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-zinc-500 text-xs">힌트 없음</span>
                )}
              </div>
            </div>

            {/* 제출 검증 결과 */}
            <div className="rounded border border-zinc-200 p-3 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">제출 검증 결과</div>
                {submitResult && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${submitResult.pass ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
                    {submitResult.pass ? "PASS" : "FAIL"}
                  </span>
                )}
              </div>
              {submitResult ? (
                isSuccess ? (
                  <div className="mt-2 flex items-center justify-between rounded border border-emerald-200 bg-emerald-50 p-3">
                    <div className="flex items-center gap-2 text-emerald-800 text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-2.1a.75.75 0 1 0-1.22-.9l-3.621 4.912-1.99-1.993a.75.75 0 1 0-1.06 1.061l2.625 2.625a.75.75 0 0 0 1.138-.089l4.128-5.616Z" clipRule="evenodd"/></svg>
                      <span className="font-medium">SUCCESS! 모든 테스트를 통과했습니다.</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={generateAndValidate} className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white shadow">다음 문제</button>
                      <button onClick={() => setSubmitResult(null)} className="rounded border px-3 py-1.5 text-xs">닫기</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs space-y-2">
                    <div className="flex gap-4">
                      <span className="text-zinc-600">validator: <b className="text-zinc-900">{submitResult.validator}</b></span>
                      <span className="text-zinc-600">total: <b className="text-zinc-900">{submitResult.total}</b></span>
                      <span className="text-zinc-600">failed: <b className="text-zinc-900">{submitResult.failed}</b></span>
                    </div>
                    <div className="overflow-auto max-h-64 border border-zinc-100 rounded">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-zinc-50">
                          <tr>
                            <th className="px-2 py-1 border-b">케이스</th>
                            <th className="px-2 py-1 border-b">결과</th>
                            <th className="px-2 py-1 border-b">출력</th>
                            <th className="px-2 py-1 border-b">에러</th>
                          </tr>
                        </thead>
                        <tbody>
                          {submitResult.results?.map((r, i) => (
                            <tr key={i} className="align-top">
                              <td className="px-2 py-1 border-b whitespace-nowrap">{r.name}</td>
                              <td className={`px-2 py-1 border-b ${r.ok ? "text-emerald-700" : "text-rose-700"}`}>{r.ok ? "OK" : "FAIL"}</td>
                              <td className="px-2 py-1 border-b max-w-[420px] overflow-hidden text-ellipsis">{r.actual ?? "-"}</td>
                              <td className="px-2 py-1 border-b max-w-[260px] overflow-hidden text-ellipsis">{r.error ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              ) : (
                <div className="mt-2 text-xs text-zinc-500">아직 제출 검증을 실행하지 않았습니다.</div>
              )}
            </div>
          </div>
        </section>
      </div>
      <style jsx>{`
        .confetti {
          position: absolute;
          top: -10px;
          background: hsl(var(--c, 142) 70% 45%);
          opacity: 0.9;
          transform: translateY(-10px) rotate(0deg);
          animation-name: fall, spin;
          animation-timing-function: ease-out, linear;
          animation-iteration-count: 1, infinite;
        }
        @keyframes fall {
          to { transform: translateY(105vh) rotate(0deg); }
        }
        @keyframes spin {
          to { transform: translateY(105vh) rotate(720deg); }
        }
        .confetti:nth-child(5n)  { --c: 142; }
        .confetti:nth-child(5n+1){ --c: 199; }
        .confetti:nth-child(5n+2){ --c: 48;  }
        .confetti:nth-child(5n+3){ --c: 351; }
        .confetti:nth-child(5n+4){ --c: 262; }
      `}</style>
    </div>
  );
}

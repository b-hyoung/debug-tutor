"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

// CodeMirror (CSR 전용 로딩)
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { stdout } from "process";

type Lang = "c" | "python";

export default function TestRunPage() {
  // ---------------- 상태 ----------------
  const [language, setLanguage] = useState<Lang>("python");
  const [code, setCode] = useState<string>(
    `# 기본 파이썬 코드
a, b = map(int, input().split())
print(a+b)`
  );
  const [input, setInput] = useState<string>("5 3");
  const [result, setResult] = useState<any>(null);   // /api/run 결과
  const [loading, setLoading] = useState(false);
  const [gen, setGen] = useState<any>(null);         // /api/problems/generate 결과

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
    const arr = JSON.parse(json.stdout);   // 문자열 → 배열
    const formatted = `[${arr.join(", ")}]`; 
    setResult(formatted);

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
      let data: any;
      try {
        data = raw ? JSON.parse(raw) : { error: "empty_response" };
      } catch {
        data = { error: "non_json_response", raw };
      }
      console.log("JSON 형태:", JSON.stringify(data, null, 2));
      setGen(data);
    } catch (e: any) {
      setGen({ error: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  // ---------------- 생성값 적용: buggy_code → 코드, test_case.input → 입력 ----------------
  useEffect(() => {
    if (gen?.buggy_code && typeof gen.buggy_code === "string") {
      setCode(gen.buggy_code);
    }
    if (gen?.test_case?.input && typeof gen.test_case.input === "string") {
      setInput(gen.test_case.input);
    }
  }, [gen]);

  // ---------------- 파생: 패널 표시용 값 ----------------
  const expectedFromGen: string | null =
    gen?.test_case?.expected_output ?? null;

  // “현재 출력”은 생성 API가 돌려준 actual_output(생성 시점의 실행 결과)을 보여줌
  const actualFromGen: string | null =
    gen?.test_case?.actual_output ?? (gen?.test_case?.error ? `ERROR: ${gen.test_case.error}` : null);

  const hintList: string[] = Array.isArray(gen?.hint_levels) ? gen.hint_levels : [];

  // ---------------- UI ----------------
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">테스트 페이지</h1>

      <section className="grid gap-4 md:grid-cols-3">
        {/* 좌측: 언어 선택 + 입력값 + 버튼 */}
        <div className="space-y-3 md:col-span-1">
          <div className="flex gap-2">
            <button
              onClick={() => setLanguage("python")}
              className={`px-3 py-1 rounded border ${language === "python" ? "bg-black text-white" : ""}`}
            >
              Python
            </button>
            <button
              onClick={() => setLanguage("c")}
              className={`px-3 py-1 rounded border ${language === "c" ? "bg-black text-white" : ""}`}
            >
              C
            </button>
          </div>

          <label className="block text-sm font-medium">입력값</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full h-24 p-2 border rounded font-mono text-sm"
            placeholder="공백 구분 정수 한 줄"
          />

          <div className="flex gap-2">
            <button
              onClick={run}
              disabled={loading}
              className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            >
              {loading ? "실행 중..." : "코드 실행"}
            </button>

            <button
              onClick={generateAndValidate}
              disabled={loading}
              className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
            >
              {loading ? "가져오는 중..." : "문제 생성"}
            </button>
          </div>
        </div>

        {/* 중앙: 코드 에디터 */}
        <div className="md:col-span-2 space-y-3">
          <label className="block text-sm font-medium">코드</label>
          <CodeMirror
            value={code}
            onChange={setCode}
            height="400px"
            extensions={codeExtensions}
            basicSetup={{ lineNumbers: true, foldGutter: true }}
          />

          {/* 결과 패널: 3열 (run 결과 / 예상 출력 / 현재 출력) */}
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <div className="text-sm font-medium mb-1">/api/run 결과</div>
              <pre className="border rounded p-3 text-xs overflow-auto min-h-24">
                {result ? JSON.stringify(result, null, 2) : "실행 결과 없음"}
              </pre>
            </div>

            <div>
              <div className="text-sm font-medium mb-1">예상 출력 (expected_output)</div>
              <pre className="border rounded p-3 text-xs overflow-auto min-h-24">
                {expectedFromGen ?? "없음"}
              </pre>
            </div>

            <div>
              <div className="text-sm font-medium mb-1">현재 출력 (actual_output)</div>
              <pre className="border rounded p-3 text-xs overflow-auto min-h-24">
                {actualFromGen ?? "없음"}
              </pre>
            </div>
          </div>

          {/* 생성 JSON 원문 + 힌트 */}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-medium mb-1">/api/problems/generate 결과</div>
              <pre className="border rounded p-3 text-xs overflow-auto min-h-24">
                {gen ? JSON.stringify(gen, null, 2) : "생성 결과 없음"}
              </pre>
            </div>

            <div>
              <div className="text-sm font-medium mb-1">힌트</div>
              <div className="border rounded p-3 text-xs min-h-24">
                {hintList.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-1">
                    {hintList.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-zinc-500">힌트 없음</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

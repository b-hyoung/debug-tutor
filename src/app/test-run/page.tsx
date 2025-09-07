"use client";

import { useState } from "react";

type Lang = "c" | "python";

const SAMPLE_CODE: Record<Lang, string> = {
  c: `#include <stdio.h>
int main(){
  int x,y; if(scanf("%d %d",&x,&y)!=2) return 0;
  // 합을 구한다 (의도적 버그: 뺄셈)
  printf("%d\\n", x - y);
  return 0;
}`,
  python: `import sys
a = list(map(int, sys.stdin.read().strip().split()))
# 합을 구한다 (의도적 버그: 최댓값만 출력)
print(max(a) if a else 0)
`,
};

export default function TestRunPage() {
  const [language, setLanguage] = useState<Lang>("python");
  const [code, setCode] = useState<string>(SAMPLE_CODE.python);
  const [input, setInput] = useState<string>("5 3 4 1 2");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [gen, setGen] = useState<any>(null);

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
      setResult(json);
    } catch (e: any) {
      setResult({ error: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  const generateAndValidate = async () => {
    setLoading(true);
    setGen(null);
    try {
      const res = await fetch(`/api/problems/generate?language=${language}`);
      const json = await res.json();
      setGen(json);
      // 생성된 buggy_code를 에디터에 바로 채워 넣어 수동 실행도 가능
      if (json?.buggy_code) setCode(json.buggy_code);
      if (json?.cases?.[0]?.input) setInput(json.cases[0].input);
    } catch (e: any) {
      setGen({ error: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  const onLangChange = (l: Lang) => {
    setLanguage(l);
    setCode(SAMPLE_CODE[l]);
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">/api/run & /api/problems/generate 테스트</h1>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="space-y-3 md:col-span-1">
          <div className="flex gap-2">
            <button
              onClick={() => onLangChange("python")}
              className={`px-3 py-1 rounded border ${language === "python" ? "bg-black text-white" : ""}`}
            >
              Python
            </button>
            <button
              onClick={() => onLangChange("c")}
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
              {loading ? "실행 중..." : "코드 실행 (/api/run)"}
            </button>

            <button
              onClick={generateAndValidate}
              disabled={loading}
              className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
            >
              {loading ? "가져오는 중..." : "문제 생성&검증 (/api/problems/generate)"}
            </button>
          </div>
        </div>

        <div className="md:col-span-2 space-y-3">
          <label className="block text-sm font-medium">코드</label>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-64 p-2 border rounded font-mono text-sm"
            spellCheck={false}
          />

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-medium mb-1">/api/run 결과</div>
              <pre className="border rounded p-3 text-xs overflow-auto min-h-24">
                {result ? JSON.stringify(result, null, 2) : "실행 결과가 여기에 표시됩니다."}
              </pre>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">/api/problems/generate 결과</div>
              <pre className="border rounded p-3 text-xs overflow-auto min-h-24">
                {gen ? JSON.stringify(gen, null, 2) : "생성/검증 결과가 여기에 표시됩니다."}
              </pre>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

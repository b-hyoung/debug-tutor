// 문자열 유틸
export const norm = (s: string) => s.trim().replace(/\r\n/g, "\n");
export const stripFences = (s: string) =>
  s.replace(/^[\s\S]*?```(?:json|jsonc|JSON)?\s*/m, "").replace(/```[\s\S]*$/m, "").trim();

// 첫 JSON 객체만 안전 슬라이스
export function sliceFirstJson(s: string) {
  const start = s.indexOf("{"); if (start < 0) throw 0;
  let d = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === '"') { while (++i < s.length && (s[i] !== '"' || s[i-1] === "\\")) {} }
    else if (c === "{") d++;
    else if (c === "}" && --d === 0) return s.slice(start, i + 1);
  }
  throw 0;
}

// LLM 응답 → 순수 JSON 파싱
export function parseLLMJson(text: string): any {
  try { return JSON.parse(text); }
  catch {
    const cleaned = sliceFirstJson(stripFences(text)).replace(/\u201C|\u201D/g, '"');
    return JSON.parse(cleaned);
  }
}

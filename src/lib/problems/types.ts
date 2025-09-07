export type Lang = "c" | "python";
export const isLang = (v: any): v is Lang => v === "c" || v === "python";

export type RawCase = { name: string; input: string; expected_output: string };
export type RawProblem = {
  title: string;
  language: Lang;
  buggy_code: string;
  test_case: RawCase;       // 단일 케이스
  hint_levels?: string[];
};

export const isCase = (v: any): v is RawCase =>
  v && typeof v.name==="string" && typeof v.input==="string" && typeof v.expected_output==="string";

export const isProblem = (v: any): v is RawProblem =>
  v && typeof v.title==="string" && isLang(v.language) &&
  typeof v.buggy_code==="string" && isCase(v.test_case) &&
  (v.hint_levels===undefined || (Array.isArray(v.hint_levels) && v.hint_levels.every((h:any)=>typeof h==="string")));

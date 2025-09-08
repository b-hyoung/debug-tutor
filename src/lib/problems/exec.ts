import { runInDocker } from "@/server/runnner";
import { RawProblem } from "./types";
import { norm } from "./json-utils";

export async function runSingleCase(raw: RawProblem) {
  const originalInput = (raw.test_case.input ?? "").trim();
  const tokens = originalInput.split(/\s+/).filter(Boolean);
  const needsCountFirst = raw.language === "c" && /\bscanf\s*\(\s*"%d"\s*,\s*&\s*n\s*\)/.test(raw.buggy_code);
  const startsWithCount = /^\s*\d+\s+/.test(originalInput);
  const inputForRun = (needsCountFirst && !startsWithCount) ? `${tokens.length} ${originalInput}` : originalInput;

  const run = await runInDocker({
    language: raw.language,
    code: raw.buggy_code,
    input: inputForRun,
  });
  const expected = norm(raw.test_case.expected_output);
  const actual = run.ok ? norm(run.stdout ?? "") : null;

  return {
    name: raw.test_case.name,
    input: raw.test_case.input,
    expected_output: expected,
    actual_output: actual,
    diff: expected !== actual,
    error: run.ok ? null : run.error,
  };
}

export const schema = {
  type: "object",
  required: ["title", "language", "buggy_code", "test_case"],
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    language: { type: "string", enum: ["c", "python"] },
    buggy_code: {
      type: "string",
      description: "버그가 포함된 코드 (주석/힌트 금지, 코드만 허용)",
    },
    test_case: {
      type: "object",
      required: ["name", "input", "expected_output"],
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        input: { type: "string" },
        expected_output: { type: "string" },
      },
    },
    hint_levels: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;


export const instructions =
  "너는 '버그 포함 알고리즘 문제' 생성기다. " +
  "반드시 지정한 JSON 스키마만 출력한다. " +
  "코드는 실행 가능해야 하지만 최소 2종류의 버그(논리/경계)를 포함해야 한다. " +
  "정상 정렬 코드는 절대 출력하지 말라. " +
  "테스트 케이스 1개를 포함하며, 해당 케이스에서 기대 출력과 실제 출력이 달라야 한다. " +
  "제목(title)은 한국어로 작성하고, hint_levels는 한국어 문장 3개 이상 제공하라.";

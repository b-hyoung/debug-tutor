// src/lib/cookies.ts
// Next.js App Router에서 서버 컴포넌트/Route Handler 내에서 쿠키를 다루기 위한 유틸.
import { cookies } from "next/headers";

/**
 * 쿠키 수명(초) 상수
 * - TEMP_SHORT: 일회성 검증(state, pkce_verifier 등) 보관
 * - SESSION_WEEK: 로그인 세션 보관(1주 예시)
 */
const TEMP_SHORT = 10 * 60; // 10분
const SESSION_WEEK = 7 * 24 * 60 * 60; // 7일

/**
 * 쿠키 기본 옵션 (보안 관련)
 * - httpOnly: JS에서 접근 불가(보안↑)
 * - sameSite: CSRF 공격 완화용. 기본은 'lax'.
 * - path: 전역 경로('/')
 * - maxAge: 만료 시간(초)
 * - secure: 프로덕션(HTTPS)에서만 true 권장 → 여기서는 런타임에서 분기 처리
 */
function baseCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  };
}

/**
 * setTemp(name, value, maxAgeSec?)
 * 역할: OAuth 등에서 일시적으로 필요한 값(state, pkce_verifier 등)을 안전하게 보관.
 * 특징: 짧은 수명(TEMP_SHORT). httpOnly로 클라이언트 JS가 접근 불가.
 */
export async function setTemp(name: string, value: string, maxAgeSec = TEMP_SHORT) {
  const cookieStore = await cookies();
  cookieStore.set(name, value, baseCookieOptions(maxAgeSec));
}

/**
 * getTemp(name)
 * 역할: 일회성 값(state, pkce_verifier 등) 읽기.
 * 주의: 읽은 뒤에는 즉시 clearTemp로 삭제하는 패턴을 권장(재사용/재전송 방지).
 */
export async function getTemp(name: string) {
  const cookieStore = await cookies();
  return cookieStore.get(name)?.value ?? null;
}

/**
 * clearTemp(name)
 * 역할: 일회성 값 삭제. 재사용을 원천 차단.
 */
export async function clearTemp(name: string) {
  const cookieStore = await cookies();
  cookieStore.delete(name);
}

/**
 * setSession(userId)
 * 역할: 인증 완료 후 서버 세션을 표현하는 쿠키를 발급.
 * 
 * 왜 userId를 저장하나?
 *  - 서버에서 해당 userId로 DB 조회하여 현재 로그인 사용자를 식별하기 위함.
 *  - 토큰 자체를 쿠키에 저장하지 않고, 최소한의 식별자만 저장(보안/관리 단순화).
 * 
 * 운영 팁:
 *  - 프로덕션에서는 secure=true(HTTPS) 권장 → baseCookieOptions에서 자동 분기.
 *  - 도메인/경로가 복잡하면 options에 domain/path를 추가로 지정.
 */
export async function setSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set("sid", userId, baseCookieOptions(SESSION_WEEK));
}

/**
 * getSession()
 * 역할: 현재 요청의 세션 쿠키 값을 읽어 사용자 식별자(userId)를 얻음.
 * 반환: userId 문자열 또는 null
 */
export async function getSession() {
  const cookieStore = await cookies();
  return cookieStore.get("sid")?.value ?? null;
}

/**
 * clearSession()
 * 역할: 로그아웃 등에서 세션 쿠키를 즉시 무효화.
 */
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("sid");
}

/**
 * ──────────────────────────────────────────────────────────────────────
 * 요약: 각자의 역할
 * - setTemp/getTemp/clearTemp: "일회성 검증 값" (OAuth state, PKCE verifier) 보관/회수/삭제
 * - setSession/getSession/clearSession: "로그인 세션"을 쿠키로 관리
 *   · setSession: 로그인 성공 시 발급
 *   · getSession: API에서 현재 사용자 식별
 *   · clearSession: 로그아웃 처리
 * 보안 포인트
 * - httpOnly 쿠키 → 브라우저 JS에서 접근 불가(XSS 완화)
 * - sameSite=lax → 외부 사이트에서의 크로스사이트 요청에 쿠키가 자동 전송되지 않도록 완화
 * - secure(프로덕션) → HTTPS에서만 전송
 * - 세션에는 토큰 원문을 두지 않고, 최소 식별자만 저장(서버가 DB로 검증)
 * ──────────────────────────────────────────────────────────────────────
 */
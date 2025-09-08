import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";


// AI로 만들기 지금은 일단 나둘꺼임
// 설마 유저가 얼마나 많아지겠어 ㅋ
// ── Nickname generators ─────────────────────────────────────────────────────
async function generateNicknameAI(user: { id: string; email?: string | null }) {
  // If you have an internal AI nickname endpoint, set NICKNAME_API_URL in .env
  // Expected response: { nickname: string }
  const url = process.env.NICKNAME_API_URL;
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s guard
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, email: user.email ?? null }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { nickname?: string };
    return data.nickname ?? null;
  } catch {
    return null;
  }
}

function sanitizeBase(base: string) {
  const cleaned = base.replace(/[^a-zA-Z0-9가-힣_]/g, "");
  return cleaned.length ? cleaned : "사용자";
}

//ai 없을 때 랜덤으로 만들기
function generateNicknameLocal(email?: string | null) {
  // Lightweight Korean nickname generator as a fallback (no AI)
  const adjs = [
    "용감한", "느긋한", "빠른", "차분한", "행복한", "성실한", "유연한", "정직한",
    "재미있는", "영리한", "든든한", "따뜻한", "근면한", "강인한", "귀여운",
  ];
  const nouns = [
    "백곰", "여우", "고래", "부엉이", "치타", "판다", "호랑이", "고양이",
    "강아지", "수달", "참새", "북극곰", "돌고래", "다람쥐", "펭귄",
  ];
  const suffixes = ["씨", "님", "선생님", "대장", "왕", "기사", "연구원", "선배"];

  const seed = Math.floor(Math.random() * 10000);
  const adj = adjs[seed % adjs.length];
  const noun = nouns[Math.floor(seed / 7) % nouns.length];
  const suffix = suffixes[Math.floor(seed / 49) % suffixes.length];

  const baseFromEmail = email?.split("@")[0] ?? "";
  const base = sanitizeBase(baseFromEmail);

  // e.g., "용감한 백곰씨" or fallback to base if present
  const nick = `${adj} ${noun}${suffix}`;
  return base ? `${nick}` : nick;
}

//DB 중복 체크
async function ensureUniqueUsername(candidate: string, maxAttempts = 5): Promise<string> {
  let name = candidate;
  for (let i = 0; i < maxAttempts; i++) {
    const exists = await prisma.user.findUnique({ where: { username: name } });
    if (!exists) return name;
    name = `${candidate}_${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
  }
  // Last resort: timestamp-based
  return `${candidate}_${Date.now().toString().slice(-6)}`;
}

export const authOptions = {
  // 로그인 한 사용자 DB 등록하기
  adapter: PrismaAdapter(prisma),
  // 세션 토큰 검증 키
  secret: process.env.AUTH_SECRET,
  // 개발/배포 환경 분기: 개발 중 호스트 검증 완화
  trustHost: process.env.AUTH_TRUST_HOST === 'true' || process.env.NODE_ENV !== 'production',
  // 디버깅 옵션(개발 전용)
  debug: process.env.NODE_ENV !== 'production',
  logger: { error: console.error, warn: console.warn, debug: console.log },

  // 구글 로그인 프로바이더 등록
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  // 이벤트 훅: 최초 로그인 시 username 자동 생성, 매 로그인마다 기록 갱신
  events: {
    async signIn({ user }) {
      const now = new Date();
      if (!user.username) {
        const ai = await generateNicknameAI({ id: user.id!, email: user.email as any });
        const fallback = generateNicknameLocal(user.email as any);
        const nick = await ensureUniqueUsername(ai ?? fallback);
        const newUsername = nick;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            username: newUsername,
            lastLoginAt: now,
            loginCount: { increment: 1 },
          },
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: now,
            loginCount: { increment: 1 },
          },
        });
      }
    },
  },

  session: { strategy: "database" }, // literal preserved by satisfies

  // 프론트에서도 session.user.id를 쓸 수 있게 확장
  callbacks: {
    async session({ session, user }: { session: any; user: any }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(authOptions);
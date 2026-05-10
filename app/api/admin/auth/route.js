import { getEnv, makeToken, checkToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { secret, password, token } = body;
    const env = getEnv();

    // URL 비밀 매치 검사
    if (!env.secret || env.secret !== secret) {
      return Response.json({ ok: false, error: 'invalid secret' });
    }

    // 토큰으로 재검증 (자동 로그인)
    if (token) {
      if (checkToken(token)) {
        return Response.json({ ok: true, token });
      }
      return Response.json({ ok: false, error: 'invalid token' });
    }

    // 비밀번호로 로그인
    if (!env.password || env.password !== password) {
      return Response.json({ ok: false, error: 'invalid password' });
    }

    return Response.json({ ok: true, token: makeToken() });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

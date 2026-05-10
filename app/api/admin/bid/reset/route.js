import { getBidState, setBidState } from '@/lib/redis';

export const dynamic = 'force-dynamic';

function verifyAdmin(secret, token) {
  if (!process.env.ADMIN_SECRET || !process.env.ADMIN_PASSWORD) return false;
  if (secret !== process.env.ADMIN_SECRET) return false;
  const expected = Buffer.from(
    `${process.env.ADMIN_SECRET}:${process.env.ADMIN_PASSWORD}`
  ).toString('base64');
  return token === expected;
}

export async function POST(req) {
  try {
    const token = req.headers.get('X-Admin-Token') || '';
    const { secret } = await req.json();

    if (!verifyAdmin(secret, token)) {
      return Response.json({ ok: false, error: '인증 실패' }, { status: 401 });
    }

    const state = await getBidState();

    // 잔고와 round, settings는 유지. 게임 상태만 초기화.
    state.status = 'idle';
    state.bids = {};
    state.results = null;
    state.startedAt = null;
    state.completedAt = null;
    await setBidState(state);

    return Response.json({ ok: true, state });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

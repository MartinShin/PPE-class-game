import { getPdState, setPdState } from '@/lib/redis';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { secret, pairs, payoff, strategies } = body;
    if (!requireAdmin(req, secret)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const state = await getPdState();
    if (state.status === 'active') {
      return Response.json({ ok: false, error: '진행 중인 게임이 있습니다. 먼저 확정 또는 초기화하세요.' });
    }

    const seen = new Set();
    for (const [a, b] of pairs) {
      if (!a || !b || a === b) return Response.json({ ok: false, error: '잘못된 짝' });
      if (seen.has(a) || seen.has(b)) return Response.json({ ok: false, error: `중복된 학생: ${a}/${b}` });
      seen.add(a); seen.add(b);
    }

    state.pairs = pairs;
    if (payoff) state.payoff = payoff;
    if (strategies && strategies.D && strategies.R) {
      state.strategies = {
        D: String(strategies.D).trim() || '부인',
        R: String(strategies.R).trim() || '고발',
      };
    }
    state.status = 'idle';
    state.choices = {};
    state.results = null;

    await setPdState(state);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

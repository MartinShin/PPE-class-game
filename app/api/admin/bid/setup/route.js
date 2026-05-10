import { getBidState, setBidState } from '@/lib/redis';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { secret, min, max, showWinnerNames } = await req.json();
    if (!requireAdmin(req, secret)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const state = await getBidState();
    if (state.status === 'active') {
      return Response.json({ ok: false, error: '진행 중인 게임이 있습니다. 먼저 확정 또는 초기화하세요.' });
    }

    const nextMin = Number(min);
    const nextMax = Number(max);
    if (!Number.isInteger(nextMin) || !Number.isInteger(nextMax)) {
      return Response.json({ ok: false, error: '최저값과 최대값은 정수여야 합니다' });
    }
    if (nextMin < 0 || nextMax < 0 || nextMin > nextMax) {
      return Response.json({ ok: false, error: '범위가 올바르지 않습니다' });
    }

    state.settings = {
      min: nextMin,
      max: nextMax,
      showWinnerNames: !!showWinnerNames,
    };
    state.status = 'idle';
    state.bids = {};
    state.results = null;
    state.completedAt = null;

    await setBidState(state);
    return Response.json({ ok: true, state });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

import { getPgState, setPgState } from '@/lib/redis';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 다음 라운드 시작 (completed → active).
// currentRound < numRounds 일 때만 가능. 같은 그룹 유지 (partner matching).
export async function POST(req) {
  try {
    const { secret } = await req.json();
    if (!requireAdmin(req, secret)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const state = await getPgState();
    if (state.status !== 'completed') {
      return Response.json({ ok: false, error: '라운드가 확정되지 않았습니다' });
    }
    if (state.currentRound >= state.settings.numRounds) {
      return Response.json({
        ok: false,
        error: `마지막 라운드입니다 (${state.settings.numRounds}/${state.settings.numRounds}). 게임을 종료하세요.`,
      });
    }

    state.status = 'active';
    state.currentRound = state.currentRound + 1;
    state.contributions = {};
    state.punishments = {};
    state.results = null;
    state.completedAt = null;
    await setPgState(state);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

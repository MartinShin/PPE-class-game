import { getPgState, setPgState } from '@/lib/redis';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 공공재 게임 상태를 초기화 (어느 상태든 → idle).
// 잔고/히스토리는 유지. 다시 그룹 편성부터 시작할 수 있게 함.
export async function POST(req) {
  try {
    const { secret } = await req.json();
    if (!requireAdmin(req, secret)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    const state = await getPgState();
    state.status = 'idle';
    state.currentRound = 0;
    state.groups = [];
    state.contributions = {};
    state.punishments = {};
    state.results = null;
    state.startedAt = null;
    state.completedAt = null;
    await setPgState(state);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

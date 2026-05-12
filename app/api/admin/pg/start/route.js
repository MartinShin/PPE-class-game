import { getPgState, setPgState } from '@/lib/redis';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 첫 라운드 시작 (idle → active).
// 이후 라운드는 /api/admin/pg/next 사용.
export async function POST(req) {
  try {
    const { secret } = await req.json();
    if (!requireAdmin(req, secret)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const state = await getPgState();
    if (state.status !== 'idle') {
      return Response.json({ ok: false, error: '이미 게임이 시작되었거나 진행 중입니다' });
    }
    if (!state.groups || state.groups.length === 0) {
      return Response.json({ ok: false, error: '그룹이 편성되지 않았습니다' });
    }

    state.status = 'active';
    state.currentRound = 1;
    state.contributions = {};
    state.punishments = {};
    state.results = null;
    state.startedAt = Date.now();
    await setPgState(state);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

import { getPgState, setPgState } from '@/lib/redis';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 처벌 모드에서: 모든 학생이 기여를 제출한 후 admin이 기여를 공개하고 처벌 단계로 전환.
// active → punishing. 처벌 OFF면 사용하지 않음 (그냥 confirm 호출).
export async function POST(req) {
  try {
    const { secret } = await req.json();
    if (!requireAdmin(req, secret)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const state = await getPgState();
    if (state.status !== 'active') {
      return Response.json({ ok: false, error: '기여 입력 단계가 아닙니다' });
    }
    if (!state.settings.punishmentEnabled) {
      return Response.json({ ok: false, error: '처벌 기능이 꺼져 있습니다' });
    }

    state.status = 'punishing';
    state.punishments = {};
    await setPgState(state);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

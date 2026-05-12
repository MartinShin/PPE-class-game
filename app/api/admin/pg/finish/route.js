import { getPgState, setPgState } from '@/lib/redis';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 모든 라운드 후 게임을 종료 (completed → finished).
// 마지막 라운드가 아니어도 종료 가능 (조기 종료).
export async function POST(req) {
  try {
    const { secret } = await req.json();
    if (!requireAdmin(req, secret)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const state = await getPgState();
    if (state.status !== 'completed') {
      return Response.json({ ok: false, error: '확정된 라운드가 없습니다' });
    }
    state.status = 'finished';
    await setPgState(state);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

import { getPdState, setPdState } from '@/lib/redis';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { secret } = await req.json();
    if (!requireAdmin(req, secret)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const state = await getPdState();
    if (!state.pairs || state.pairs.length === 0) {
      return Response.json({ ok: false, error: '짝이 설정되지 않았습니다' });
    }
    state.status = 'active';
    state.round = (state.round || 0) + 1;
    state.choices = {};
    state.results = null;
    state.startedAt = Date.now();
    await setPdState(state);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

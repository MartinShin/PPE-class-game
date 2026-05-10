import { getBidState, setBidState, getStudent } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { studentId, bid } = await req.json();

    const student = await getStudent(studentId);
    if (!student) return Response.json({ ok: false, error: '학생을 찾을 수 없습니다' });

    const state = await getBidState();
    if (state.status !== 'active') {
      return Response.json({ ok: false, error: '게임이 진행 중이 아닙니다' });
    }

    if (state.bids?.[studentId] !== undefined) {
      return Response.json({ ok: false, error: '이미 제출했습니다' });
    }

    const n = Number(bid);
    if (!Number.isInteger(n)) {
      return Response.json({ ok: false, error: '0을 포함한 자연수만 제출할 수 있습니다' });
    }

    const min = Number(state.settings?.min ?? 0);
    const max = Number(state.settings?.max ?? 10000);
    if (n < min || n > max || n < 0) {
      return Response.json({ ok: false, error: `${min}원 이상 ${max}원 이하의 숫자만 제출할 수 있습니다` });
    }

    state.bids = { ...(state.bids || {}), [studentId]: n };
    await setBidState(state);

    return Response.json({ ok: true, bid: n });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

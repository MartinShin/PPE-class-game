import { getPdState, setPdState, getStudent } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { studentId, choice } = await req.json();
    if (!['D', 'R'].includes(choice)) {
      return Response.json({ ok: false, error: '잘못된 선택' });
    }
    const student = await getStudent(studentId);
    if (!student) return Response.json({ ok: false, error: '학생을 찾을 수 없습니다' });

    const state = await getPdState();
    if (state.status !== 'active') {
      return Response.json({ ok: false, error: '게임이 진행 중이 아닙니다' });
    }
    const inPair = state.pairs.some((p) => p.includes(studentId));
    if (!inPair) return Response.json({ ok: false, error: '짝이 배정되지 않았습니다' });

    if (state.choices?.[studentId]) {
      return Response.json({ ok: false, error: '이미 선택했습니다' });
    }

    state.choices = { ...(state.choices || {}), [studentId]: choice };
    await setPdState(state);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

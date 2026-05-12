import { getPgState, setPgState, getStudent } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// 처벌 모드: 같은 그룹의 다른 멤버 각각에게 처벌 포인트(0..max) 할당.
// payload: { studentId, targets: { targetId: points, ... } }
export async function POST(req) {
  try {
    const { studentId, targets } = await req.json();
    const student = await getStudent(studentId);
    if (!student) return Response.json({ ok: false, error: '학생을 찾을 수 없습니다' });

    const state = await getPgState();
    if (state.status !== 'punishing') {
      return Response.json({ ok: false, error: '처벌 단계가 아닙니다' });
    }
    if (!state.settings.punishmentEnabled) {
      return Response.json({ ok: false, error: '처벌 기능이 꺼져 있습니다' });
    }

    const myGroup = state.groups.find((g) => g.includes(studentId));
    if (!myGroup) return Response.json({ ok: false, error: '그룹이 배정되지 않았습니다' });

    if (state.punishments?.[studentId] !== undefined) {
      return Response.json({ ok: false, error: '이미 처벌을 제출했습니다' });
    }

    const max = state.settings.punishmentMax || 10;
    const clean = {};
    const raw = targets || {};
    for (const tid of Object.keys(raw)) {
      // 본인은 처벌 못 함. 같은 그룹에 있어야 함.
      if (tid === studentId) continue;
      if (!myGroup.includes(tid)) continue;
      let p = Number(raw[tid]);
      if (!Number.isFinite(p) || p < 0) p = 0;
      p = Math.min(Math.floor(p), max);
      if (p > 0) clean[tid] = p;
    }

    state.punishments = { ...(state.punishments || {}), [studentId]: clean };
    await setPgState(state);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

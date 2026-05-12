import { getPgState, setPgState, getStudent } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// 학생이 라운드에 기여를 제출한다.
// - 이산형: contribution = 'C' (기여) 또는 'N' (비기여)
// - 연속형: contribution = 숫자 (0 이상, endowment 이하, increment 배수)
export async function POST(req) {
  try {
    const { studentId, contribution } = await req.json();
    const student = await getStudent(studentId);
    if (!student) return Response.json({ ok: false, error: '학생을 찾을 수 없습니다' });

    const state = await getPgState();
    if (state.status !== 'active') {
      return Response.json({ ok: false, error: '기여 입력 단계가 아닙니다' });
    }

    // 그룹 배정 여부 확인
    const inGroup = state.groups.some((g) => g.includes(studentId));
    if (!inGroup) return Response.json({ ok: false, error: '그룹이 배정되지 않았습니다' });

    if (state.contributions?.[studentId] !== undefined) {
      return Response.json({ ok: false, error: '이미 기여를 제출했습니다' });
    }

    // 모드별 유효성 검증
    const { mode, endowment, increment } = state.settings;
    let value;
    if (mode === 'discrete') {
      if (contribution !== 'C' && contribution !== 'N') {
        return Response.json({ ok: false, error: '잘못된 선택 (C/N만 허용)' });
      }
      value = contribution;
    } else {
      // 연속형
      const n = Number(contribution);
      if (!Number.isFinite(n) || n < 0 || n > endowment) {
        return Response.json({ ok: false, error: `0 ~ ${endowment}원 사이여야 합니다` });
      }
      // increment 배수로 정렬 (반올림)
      const stepped = Math.round(n / increment) * increment;
      if (stepped < 0 || stepped > endowment) {
        return Response.json({ ok: false, error: '범위를 벗어났습니다' });
      }
      value = stepped;
    }

    state.contributions = { ...(state.contributions || {}), [studentId]: value };
    await setPgState(state);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

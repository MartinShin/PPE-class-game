import { getPdState, setPdState, addBalance, pushPdHistory } from '@/lib/redis';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { secret } = await req.json();
    if (!requireAdmin(req, secret)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const state = await getPdState();
    if (state.status !== 'active') {
      return Response.json({ ok: false, error: '진행 중인 게임이 없습니다' });
    }

    // 페이오프 키 헬퍼 (행 학생 선택 + 열 학생 선택)
    const keyOf = (rowChoice, colChoice) => `${rowChoice}${colChoice}`; // 'DD','DR','RD','RR'

    const results = {};
    for (const [rowId, colId] of state.pairs) {
      const rowChoice = state.choices?.[rowId] || 'D'; // 미선택은 부인 처리
      const colChoice = state.choices?.[colId] || 'D';
      const k = keyOf(rowChoice, colChoice);
      const [rowPay, colPay] = state.payoff[k] || [0, 0];

      results[rowId] = { myChoice: rowChoice, opponentChoice: colChoice, payoff: rowPay, role: 'row', opponent: colId };
      results[colId] = { myChoice: colChoice, opponentChoice: rowChoice, payoff: colPay, role: 'col', opponent: rowId };

      await addBalance(rowId, rowPay);
      await addBalance(colId, colPay);
    }

    state.status = 'completed';
    state.results = results;
    state.completedAt = Date.now();
    await setPdState(state);

    // 히스토리 저장
    await pushPdHistory({
      round: state.round,
      pairs: state.pairs,
      choices: state.choices,
      payoff: state.payoff,
      results,
      completedAt: state.completedAt,
    });

    return Response.json({ ok: true, results });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

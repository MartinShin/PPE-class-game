import {
  getBidState,
  setBidState,
  getStudents,
  addBalance,
  pushBidHistory,
  floorToOneDecimal,
} from '@/lib/redis';

export const dynamic = 'force-dynamic';

function verifyAdmin(secret, token) {
  if (!process.env.ADMIN_SECRET || !process.env.ADMIN_PASSWORD) return false;
  if (secret !== process.env.ADMIN_SECRET) return false;
  const expected = Buffer.from(
    `${process.env.ADMIN_SECRET}:${process.env.ADMIN_PASSWORD}`
  ).toString('base64');
  return token === expected;
}

export async function POST(req) {
  try {
    const token = req.headers.get('X-Admin-Token') || '';
    const { secret } = await req.json();

    if (!verifyAdmin(secret, token)) {
      return Response.json({ ok: false, error: '인증 실패' }, { status: 401 });
    }

    const state = await getBidState();
    if (state.status !== 'active') {
      return Response.json({
        ok: false,
        error: '진행 중인 게임이 없습니다',
      });
    }

    const bidEntries = Object.entries(state.bids || {});
    if (bidEntries.length === 0) {
      return Response.json({
        ok: false,
        error: '제출된 입찰이 없습니다',
      });
    }

    // 최저값 계산
    const bidValues = bidEntries.map(([, v]) => Number(v));
    const lowestBid = Math.min(...bidValues);

    // 우승자 찾기 (최저값을 제출한 학생들)
    const winnerIds = bidEntries
      .filter(([, v]) => Number(v) === lowestBid)
      .map(([id]) => id);
    const winnerCount = winnerIds.length;

    // 학생 이름 매핑
    const students = await getStudents();
    const nameOf = (id) =>
      students.find((s) => s.id === id)?.name || id;
    const winnerNames = winnerIds.map(nameOf);

    // 상금 계산: lowestBid / winnerCount, 소수점 첫째 자리에서 버림
    const prizePerWinner = floorToOneDecimal(lowestBid / winnerCount);

    // 모든 참여자의 보수 기록
    const payoffs = {};
    for (const [sid] of bidEntries) {
      payoffs[sid] = winnerIds.includes(sid) ? prizePerWinner : 0;
    }

    // 우승자 잔고 반영
    for (const wid of winnerIds) {
      await addBalance(wid, prizePerWinner);
    }

    state.results = {
      lowestBid,
      winnerIds,
      winnerNames,
      winnerCount,
      prizePerWinner,
      payoffs,
    };
    state.status = 'completed';
    state.completedAt = Date.now();
    await setBidState(state);

    // 히스토리 기록
    await pushBidHistory({
      round: state.round,
      bids: state.bids,
      results: state.results,
      settings: state.settings,
      completedAt: state.completedAt,
    });

    return Response.json({ ok: true, state });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

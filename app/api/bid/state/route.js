import { getBidState } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');
    const admin = searchParams.get('admin') === '1';

    const state = await getBidState();

    if (admin) {
      return Response.json({ ok: true, state });
    }

    const myBid = studentId && state.bids ? state.bids[studentId] : undefined;
    const myPayoff = studentId && state.results?.payoffs ? state.results.payoffs[studentId] : undefined;

    const publicState = {
      status: state.status,
      round: state.round,
      settings: state.settings,
      myBid,
      results: null,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
    };

    if (state.status === 'completed' && state.results) {
      publicState.results = {
        lowestBid: state.results.lowestBid,
        winnerCount: state.results.winnerCount,
        prizePerWinner: state.results.prizePerWinner,
        myPayoff: myPayoff ?? 0,
        isWinner: studentId ? state.results.winnerIds?.includes(studentId) : false,
        winnerNames: state.settings?.showWinnerNames ? state.results.winnerNames : null,
      };
    }

    return Response.json({ ok: true, state: publicState });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

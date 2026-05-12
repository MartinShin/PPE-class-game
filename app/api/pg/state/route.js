import { getPgState } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// 학생 시점 상태 조회.
// 'punishing' 단계 전에는 다른 학생의 기여를 마스킹할 수도 있으나,
// 어차피 동시 결정이므로 그대로 보내고 학생 UI에서 결과를 가린다.
// (PD와 동일한 방식. 보안이 더 필요하면 여기서 마스킹할 것.)
export async function GET() {
  try {
    const state = await getPgState();
    return Response.json({ ok: true, state });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

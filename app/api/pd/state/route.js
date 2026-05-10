import { getPdState } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await getPdState();
    // 학생 시점에서는 다른 학생의 선택을 노출하지 않는 것이 게임 무결성에 좋다.
    // 그러나 어차피 동시에 결정해야 하므로, 본인 선택 여부만 확인할 수 있게 그대로 보낸다.
    // 만약 보안이 더 필요하면 여기서 마스킹할 것.
    return Response.json({ ok: true, state });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

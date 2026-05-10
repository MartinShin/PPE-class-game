import { getStudent, getBalance } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  try {
    const { id } = params;
    const s = await getStudent(id);
    if (!s) return Response.json({ ok: false, error: '학생을 찾을 수 없습니다' }, { status: 404 });
    const balance = await getBalance(id);
    return Response.json({ ok: true, student: { id: s.id, name: s.name, balance } });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

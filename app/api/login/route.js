import { getStudents } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { id, pin } = await req.json();
    const students = await getStudents();
    const found = students.find((s) => s.id === id);
    if (!found) return Response.json({ ok: false, error: '학생을 찾을 수 없습니다' });
    if (String(found.pin) !== String(pin)) {
      return Response.json({ ok: false, error: 'PIN이 올바르지 않습니다' });
    }
    return Response.json({ ok: true, student: { id: found.id, name: found.name } });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

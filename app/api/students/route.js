import { getStudents } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const students = await getStudents();
    // PIN은 노출하지 않는다
    const safe = students.map((s) => ({ id: s.id, name: s.name }));
    return Response.json({ ok: true, students: safe });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

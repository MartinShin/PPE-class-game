import { getStudents } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const showTest = url.searchParams.get('test') === '1';

    const students = await getStudents();
    const filtered = showTest ? students : students.filter((s) => !s.isTest);

    // PIN은 절대 노출하지 않는다. isTest는 UI 표시용으로 보낸다.
    const safe = filtered.map((s) => ({ id: s.id, name: s.name, isTest: !!s.isTest }));
    return Response.json({ ok: true, students: safe });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

import { getStudents, getBalance } from '@/lib/redis';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');
    if (!requireAdmin(req, secret)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const students = await getStudents();
    const withBalance = await Promise.all(
      students.map(async (s) => ({
        ...s,
        balance: await getBalance(s.id),
      }))
    );
    return Response.json({ ok: true, students: withBalance });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

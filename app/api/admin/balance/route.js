import { addBalance, setBalance, getBalance } from '@/lib/redis';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { secret, studentId, amount, set } = body;
    if (!requireAdmin(req, secret)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    if (typeof set === 'number') {
      await setBalance(studentId, set);
    } else {
      await addBalance(studentId, Number(amount) || 0);
    }
    const b = await getBalance(studentId);
    return Response.json({ ok: true, balance: b });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

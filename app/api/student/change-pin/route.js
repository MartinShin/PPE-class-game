import { getStudent, updateStudent } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { id, currentPin, newPin } = await req.json();
    if (!id || !newPin) return Response.json({ ok: false, error: '필수 항목 누락' });
    if (!/^\d{4}$/.test(String(newPin))) {
      return Response.json({ ok: false, error: 'PIN은 4자리 숫자여야 합니다' });
    }
    const s = await getStudent(id);
    if (!s) return Response.json({ ok: false, error: '학생을 찾을 수 없습니다' });
    if (String(s.pin) !== String(currentPin)) {
      return Response.json({ ok: false, error: '현재 PIN이 일치하지 않습니다' });
    }
    await updateStudent(id, { pin: String(newPin) });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

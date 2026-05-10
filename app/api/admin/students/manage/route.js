import {
  addStudent, updateStudent, deleteStudent, nextStudentId,
} from '@/lib/redis';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { secret, action } = body;
    if (!requireAdmin(req, secret)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    if (action === 'add') {
      const { name, isTest } = body;
      if (!name || !name.trim()) return Response.json({ ok: false, error: '이름이 필요합니다' });
      const id = await nextStudentId(!!isTest);
      const created = await addStudent({ id, name: name.trim(), pin: '1111', isTest: !!isTest });
      return Response.json({ ok: true, student: created });
    }

    if (action === 'update') {
      const { id, name, isTest } = body;
      if (!id) return Response.json({ ok: false, error: 'id 누락' });
      const patch = {};
      if (typeof name === 'string') patch.name = name.trim();
      if (typeof isTest === 'boolean') patch.isTest = isTest;
      const updated = await updateStudent(id, patch);
      if (!updated) return Response.json({ ok: false, error: '학생을 찾을 수 없습니다' });
      return Response.json({ ok: true, student: updated });
    }

    if (action === 'reset-pin') {
      const { id } = body;
      const updated = await updateStudent(id, { pin: '1111' });
      if (!updated) return Response.json({ ok: false, error: '학생을 찾을 수 없습니다' });
      return Response.json({ ok: true });
    }

    if (action === 'delete') {
      const { id } = body;
      const ok = await deleteStudent(id);
      return Response.json({ ok });
    }

    return Response.json({ ok: false, error: '알 수 없는 action' });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

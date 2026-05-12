import { getPgState, setPgState } from '@/lib/redis';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 설정 + 그룹 편성 저장.
// idle 상태에서만 변경 가능 (게임 진행 중 변경 금지).
// 진행 중인 게임이 있으면 먼저 reset해야 함.
export async function POST(req) {
  try {
    const body = await req.json();
    const { secret, groups, settings } = body;
    if (!requireAdmin(req, secret)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const state = await getPgState();
    if (state.status !== 'idle') {
      return Response.json({
        ok: false,
        error: '진행 중인 게임이 있습니다. 먼저 초기화하세요.',
      });
    }

    // 그룹 유효성 검사: 빈 그룹 제외, 학생 ID 중복 금지
    const cleanedGroups = (groups || [])
      .map((g) => (g || []).filter((id) => !!id))
      .filter((g) => g.length >= 2); // 최소 2명 이상이어야 게임 의미

    const seen = new Set();
    for (const g of cleanedGroups) {
      for (const id of g) {
        if (seen.has(id)) {
          return Response.json({ ok: false, error: `학생 ${id}이(가) 여러 그룹에 중복됨` });
        }
        seen.add(id);
      }
    }

    // 설정 병합 (들어온 키만 갱신)
    if (settings && typeof settings === 'object') {
      const cur = state.settings;
      const next = { ...cur };

      if (settings.mode === 'discrete' || settings.mode === 'continuous') {
        next.mode = settings.mode;
      }
      if (settings.cost !== undefined) next.cost = Math.max(0, Number(settings.cost) || 0);
      if (settings.benefit !== undefined) next.benefit = Math.max(0, Number(settings.benefit) || 0);
      if (settings.endowment !== undefined) next.endowment = Math.max(0, Number(settings.endowment) || 0);
      if (settings.mpcr !== undefined) {
        const m = Number(settings.mpcr);
        if (Number.isFinite(m) && m >= 0 && m <= 1) next.mpcr = m;
      }
      if (settings.increment !== undefined) {
        const i = Math.max(1, Math.floor(Number(settings.increment) || 1));
        next.increment = i;
      }
      if (settings.numRounds !== undefined) {
        const r = Math.max(1, Math.floor(Number(settings.numRounds) || 1));
        next.numRounds = r;
      }
      if (settings.punishmentEnabled !== undefined) {
        next.punishmentEnabled = !!settings.punishmentEnabled;
      }
      if (settings.punishmentCost !== undefined) {
        next.punishmentCost = Math.max(0, Number(settings.punishmentCost) || 0);
      }
      if (settings.punishmentEffect !== undefined) {
        next.punishmentEffect = Math.max(0, Number(settings.punishmentEffect) || 0);
      }
      if (settings.punishmentMax !== undefined) {
        next.punishmentMax = Math.max(0, Math.floor(Number(settings.punishmentMax) || 0));
      }
      if (settings.exchangeRate !== undefined) {
        next.exchangeRate = Math.max(1, Number(settings.exchangeRate) || 1500);
      }
      if (settings.strategies && typeof settings.strategies === 'object') {
        const C = String(settings.strategies.C || '').trim() || '기여하기';
        const N = String(settings.strategies.N || '').trim() || '기여하지 않기';
        next.strategies = { C, N };
      }
      state.settings = next;
    }

    state.groups = cleanedGroups;
    state.currentRound = 0;
    state.contributions = {};
    state.punishments = {};
    state.results = null;
    await setPgState(state);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

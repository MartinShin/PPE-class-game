import { getPgState, setPgState, addBalance, pushPgHistory } from '@/lib/redis';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 라운드 결과 확정 (active → completed, 또는 punishing → completed).
// 보수를 계산하고 잔고에 반영하며 히스토리에 저장한다.
//
// 보수 계산:
// [이산형] 그룹 내 기여자 수 k, 각 학생의 라운드 보수:
//   - 기여한 학생:    k*B - C
//   - 기여하지 않은: k*B
// [연속형] 그룹 총 기여 S, 학생 i 라운드 보수:
//   - (endowment - c_i) + MPCR * S
// [처벌 ON일 때] 라운드 보수 -= punishmentCost * (학생이 가한 처벌 총합)
//                         -= punishmentEffect * (학생이 받은 처벌 총합)
export async function POST(req) {
  try {
    const { secret } = await req.json();
    if (!requireAdmin(req, secret)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const state = await getPgState();
    if (state.status !== 'active' && state.status !== 'punishing') {
      return Response.json({ ok: false, error: '진행 중인 라운드가 없습니다' });
    }

    const { mode, cost, benefit, endowment, mpcr,
            punishmentEnabled, punishmentCost, punishmentEffect } = state.settings;
    const contributions = state.contributions || {};
    const punishments = state.punishments || {};

    const results = {};

    for (const group of state.groups) {
      // 기여 보수 계산
      let groupBasePayoff = {}; // { studentId: 라운드 기본 보수 }
      let groupContribInfo = {}; // { studentId: { contributed:bool, amount:number } }

      if (mode === 'discrete') {
        const contribFlag = {};
        let k = 0;
        for (const id of group) {
          const c = contributions[id];
          // 미제출은 'N' (비기여)로 처리
          const did = c === 'C';
          contribFlag[id] = did;
          if (did) k++;
        }
        for (const id of group) {
          const base = k * benefit - (contribFlag[id] ? cost : 0);
          groupBasePayoff[id] = base;
          groupContribInfo[id] = {
            contributed: contribFlag[id],
            amount: contribFlag[id] ? cost : 0,
          };
        }
      } else {
        // 연속형
        const amount = {};
        let total = 0;
        for (const id of group) {
          const v = contributions[id];
          const n = typeof v === 'number' ? v : 0; // 미제출은 0으로 처리
          amount[id] = n;
          total += n;
        }
        for (const id of group) {
          const base = (endowment - amount[id]) + mpcr * total;
          groupBasePayoff[id] = base;
          groupContribInfo[id] = {
            contributed: amount[id] > 0,
            amount: amount[id],
          };
        }
      }

      // 처벌 반영
      let punishGiven = {};   // { id: total points 가한 }
      let punishReceived = {}; // { id: total points 받은 }
      for (const id of group) {
        punishGiven[id] = 0;
        punishReceived[id] = 0;
      }
      if (punishmentEnabled) {
        for (const punisherId of Object.keys(punishments)) {
          if (!group.includes(punisherId)) continue;
          const targets = punishments[punisherId] || {};
          for (const targetId of Object.keys(targets)) {
            if (!group.includes(targetId)) continue;
            if (targetId === punisherId) continue;
            const p = Number(targets[targetId]) || 0;
            if (p <= 0) continue;
            punishGiven[punisherId] = (punishGiven[punisherId] || 0) + p;
            punishReceived[targetId] = (punishReceived[targetId] || 0) + p;
          }
        }
      }

      // 최종 라운드 보수 계산 + 잔고 반영
      for (const id of group) {
        const base = groupBasePayoff[id];
        const given = punishGiven[id] || 0;
        const received = punishReceived[id] || 0;
        const punishCostTotal = punishmentEnabled ? punishmentCost * given : 0;
        const punishLoss = punishmentEnabled ? punishmentEffect * received : 0;
        const roundPayoff = Math.round(base - punishCostTotal - punishLoss);

        results[id] = {
          group: group.slice(),
          mode,
          contribution: groupContribInfo[id], // { contributed, amount }
          basePayoff: Math.round(base),
          punishGiven: given,
          punishReceived: received,
          punishCostTotal,
          punishLoss,
          roundPayoff,
          contributorsCount: group.reduce(
            (acc, gid) => acc + (groupContribInfo[gid].contributed ? 1 : 0),
            0
          ),
          groupSize: group.length,
        };

        await addBalance(id, roundPayoff);
      }
    }

    state.status = 'completed';
    state.results = results;
    state.completedAt = Date.now();
    await setPgState(state);

    // 히스토리 저장
    await pushPgHistory({
      round: state.currentRound,
      mode,
      settings: state.settings,
      groups: state.groups,
      contributions,
      punishments,
      results,
      completedAt: state.completedAt,
    });

    return Response.json({ ok: true, results });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

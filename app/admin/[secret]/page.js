'use client';
import { useEffect, useState } from 'react';

export default function AdminPage({ params }) {
  const { secret } = params;
  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState('');
  const [authError, setAuthError] = useState('');

  async function login() {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, password: pwd }),
    });
    const data = await res.json();
    if (data.ok) {
      sessionStorage.setItem('admin-token', data.token);
      setAuthed(true);
    } else {
      setAuthError('비밀번호가 틀렸거나 URL이 잘못되었습니다');
    }
  }

  useEffect(() => {
    const token = sessionStorage.getItem('admin-token');
    if (token) {
      fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, token }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setAuthed(true);
        });
    }
  }, [secret]);

  if (!authed) {
    return (
      <div className="container">
        <div className="header">
          <div className="title-kor">관리자 로그인</div>
          <div className="subtitle">교수 전용</div>
        </div>
        <div className="card">
          <label className="label">비밀번호</label>
          <input
            className="input"
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            autoFocus
          />
          {authError && <div className="error">{authError}</div>}
          <div style={{ height: 12 }} />
          <button className="btn btn-block btn-accent" onClick={login}>
            로그인
          </button>
        </div>
      </div>
    );
  }

  return <AdminDashboard secret={secret} />;
}

function AdminDashboard({ secret }) {
  const [students, setStudents] = useState([]);
  const [pdState, setPdState] = useState(null);
  const [bidState, setBidState] = useState(null);
  const [pgState, setPgState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [pairs, setPairs] = useState([]);
  const [payoff, setPayoff] = useState(null);
  const [strategies, setStrategies] = useState(null);

  // 게임 1 설정 (편집 중 보전용)
  const [bidSettings, setBidSettings] = useState(null);

  // 게임 3 설정 + 그룹 (편집 중 보전용)
  const [pgSettings, setPgSettings] = useState(null);
  const [pgGroups, setPgGroups] = useState([]);
  const [autoGroupSize, setAutoGroupSize] = useState(4);

  const [newStudentName, setNewStudentName] = useState('');
  const [newIsTest, setNewIsTest] = useState(false);

  const token =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('admin-token')
      : '';

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-Admin-Token': token || '',
    };
  }

  // 동적 전략 라벨
  const sLabel = (key) =>
    strategies?.[key] || (key === 'D' ? '부인' : '고발');

  async function refresh() {
    const [r1, r2, r3, r4] = await Promise.all([
      fetch(`/api/admin/students?secret=${secret}`, {
        headers: authHeaders(),
      }).then((r) => r.json()),
      fetch('/api/pd/state').then((r) => r.json()),
      fetch('/api/bid/state?admin=1').then((r) => r.json()),
      fetch('/api/pg/state').then((r) => r.json()),
    ]);
    if (r1.ok) setStudents(r1.students);
    if (r2.ok) {
      setPdState(r2.state);
      setPairs((prev) =>
        prev.length === 0 && r2.state.pairs?.length ? r2.state.pairs : prev
      );
      setPayoff((prev) => prev || r2.state.payoff || null);
      setStrategies(
        (prev) => prev || r2.state.strategies || { D: '부인', R: '고발' }
      );
    }
    if (r3.ok) {
      setBidState(r3.state);
      setBidSettings(
        (prev) =>
          prev ||
          r3.state.settings || {
            min: 0,
            max: 10000,
            showWinnerNames: false,
          }
      );
    }
    if (r4.ok) {
      setPgState(r4.state);
      setPgSettings((prev) => prev || r4.state.settings);
      setPgGroups((prev) =>
        prev.length === 0 && r4.state.groups?.length ? r4.state.groups : prev
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  // ============ 게임 1: 최저가 입찰 컨트롤 ============
  async function saveBidSetup() {
    const res = await fetch('/api/admin/bid/setup', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        secret,
        min: Number(bidSettings?.min ?? 0),
        max: Number(bidSettings?.max ?? 10000),
        showWinnerNames: !!bidSettings?.showWinnerNames,
      }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 게임 1 설정 저장됨' : `오류: ${data.error}`);
    refresh();
  }

  async function startBidGame() {
    if (!confirm('최저가 입찰 게임을 시작하시겠습니까?')) return;
    const res = await fetch('/api/admin/bid/start', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 게임 1 시작' : `오류: ${data.error}`);
    refresh();
  }

  async function confirmBidGame() {
    if (
      !confirm(
        '결과를 확정하면 우승자 잔고에 상금이 반영됩니다. 진행할까요?'
      )
    )
      return;
    const res = await fetch('/api/admin/bid/confirm', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 게임 1 확정. 잔고 반영됨' : `오류: ${data.error}`);
    refresh();
  }

  async function resetBidGame() {
    if (
      !confirm(
        '게임 1 상태를 초기화합니다 (잔고와 설정은 유지). 계속할까요?'
      )
    )
      return;
    const res = await fetch('/api/admin/bid/reset', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 게임 1 초기화됨' : `오류: ${data.error}`);
    refresh();
  }

  // ============ 게임 2: 죄수의 딜레마 컨트롤 ============
  function autoPair() {
    const ids = students.filter((s) => !s.isTest).map((s) => s.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const newPairs = [];
    for (let i = 0; i < ids.length - 1; i += 2)
      newPairs.push([ids[i], ids[i + 1]]);
    setPairs(newPairs);
  }

  function setPair(idx, slot, value) {
    const next = pairs.map((p, i) => (i === idx ? [...p] : p));
    next[idx][slot] = value;
    setPairs(next);
  }
  function addPair() {
    setPairs([...pairs, ['', '']]);
  }
  function removePair(idx) {
    setPairs(pairs.filter((_, i) => i !== idx));
  }

  async function setupGame() {
    const cleaned = pairs.filter((p) => p[0] && p[1] && p[0] !== p[1]);
    const res = await fetch('/api/admin/pd/setup', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret, pairs: cleaned, payoff, strategies }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 설정 저장됨' : `오류: ${data.error}`);
    refresh();
  }

  async function startGame() {
    const res = await fetch('/api/admin/pd/start', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 게임 시작' : `오류: ${data.error}`);
    refresh();
  }

  async function confirmGame() {
    if (
      !confirm('확정하면 보수가 모든 학생의 잔고에 반영됩니다. 진행할까요?')
    )
      return;
    const res = await fetch('/api/admin/pd/confirm', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 확정 완료. 잔고 반영됨' : `오류: ${data.error}`);
    refresh();
  }

  async function resetGame() {
    if (!confirm('게임 상태를 초기화합니다 (잔고는 유지). 계속할까요?'))
      return;
    const res = await fetch('/api/admin/pd/reset', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 초기화됨' : `오류: ${data.error}`);
    setPairs([]);
    refresh();
  }

  // ============ 게임 3: 공공재 게임 컨트롤 ============
  function autoMakeGroups() {
    const size = Math.max(2, Math.floor(Number(autoGroupSize) || 4));
    const ids = students.filter((s) => !s.isTest).map((s) => s.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const groups = [];
    for (let i = 0; i < ids.length; i += size) {
      groups.push(ids.slice(i, i + size));
    }
    // 마지막 그룹이 너무 작으면(2명 미만) 앞 그룹에 합치기
    if (groups.length >= 2 && groups[groups.length - 1].length < 2) {
      const last = groups.pop();
      groups[groups.length - 1].push(...last);
    }
    setPgGroups(groups);
  }

  function addPgGroup() {
    setPgGroups([...pgGroups, []]);
  }
  function removePgGroup(gIdx) {
    setPgGroups(pgGroups.filter((_, i) => i !== gIdx));
  }
  function addPgMember(gIdx) {
    const next = pgGroups.map((g, i) => (i === gIdx ? [...g, ''] : g));
    setPgGroups(next);
  }
  function removePgMember(gIdx, mIdx) {
    const next = pgGroups.map((g, i) =>
      i === gIdx ? g.filter((_, j) => j !== mIdx) : g
    );
    setPgGroups(next);
  }
  function setPgMember(gIdx, mIdx, value) {
    const next = pgGroups.map((g, i) =>
      i === gIdx ? g.map((m, j) => (j === mIdx ? value : m)) : g
    );
    setPgGroups(next);
  }

  async function savePgSetup() {
    const cleaned = pgGroups
      .map((g) => g.filter((id) => !!id))
      .filter((g) => g.length >= 2);
    const res = await fetch('/api/admin/pg/setup', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        secret,
        groups: cleaned,
        settings: pgSettings,
      }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 게임 3 설정 저장됨' : `오류: ${data.error}`);
    refresh();
  }

  async function startPgGame() {
    if (!confirm('공공재 게임을 시작합니다. 진행할까요?')) return;
    const res = await fetch('/api/admin/pg/start', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 게임 3 시작 (라운드 1)' : `오류: ${data.error}`);
    refresh();
  }

  async function revealPgContrib() {
    if (
      !confirm(
        '기여를 공개하고 처벌 단계로 전환합니다. 모든 학생이 기여를 제출한 후에 진행하세요.'
      )
    )
      return;
    const res = await fetch('/api/admin/pg/reveal', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 기여 공개. 처벌 단계 시작' : `오류: ${data.error}`);
    refresh();
  }

  async function confirmPgRound() {
    if (
      !confirm(
        '이 라운드의 보수를 계산해 모든 학생 잔고에 반영합니다. 진행할까요?'
      )
    )
      return;
    const res = await fetch('/api/admin/pg/confirm', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 라운드 확정, 잔고 반영됨' : `오류: ${data.error}`);
    refresh();
  }

  async function nextPgRound() {
    const res = await fetch('/api/admin/pg/next', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 다음 라운드 시작' : `오류: ${data.error}`);
    refresh();
  }

  async function finishPgGame() {
    if (!confirm('공공재 게임을 종료합니다. 진행할까요?')) return;
    const res = await fetch('/api/admin/pg/finish', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 게임 3 종료' : `오류: ${data.error}`);
    refresh();
  }

  async function resetPgGame() {
    if (
      !confirm(
        '공공재 게임 상태를 초기화합니다 (잔고와 히스토리는 유지). 계속할까요?'
      )
    )
      return;
    const res = await fetch('/api/admin/pg/reset', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 게임 3 초기화됨' : `오류: ${data.error}`);
    setPgGroups([]);
    refresh();
  }

  // ============ 잔고 ============
  async function adjustBalance(studentId, delta) {
    const amt = prompt(
      `${delta > 0 ? '추가' : '차감'}할 금액(원)을 입력하세요`,
      '1000'
    );
    if (!amt) return;
    const n = parseInt(amt, 10);
    if (isNaN(n)) return;
    const res = await fetch('/api/admin/balance', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        secret,
        studentId,
        amount: delta * n,
      }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 잔고 조정됨' : `오류: ${data.error}`);
    refresh();
  }

  async function setBalanceTo(studentId, currentBalance) {
    const amt = prompt(`잔고를 얼마로 설정할까요?`, String(currentBalance));
    if (amt === null) return;
    const n = parseInt(amt, 10);
    if (isNaN(n)) return;
    const res = await fetch('/api/admin/balance', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret, studentId, set: n }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 잔고 설정됨' : `오류: ${data.error}`);
    refresh();
  }

  // ============ 학생 관리 ============
  async function manageStudent(action, payload = {}) {
    const res = await fetch('/api/admin/students/manage', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret, action, ...payload }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 완료' : `오류: ${data.error}`);
    refresh();
    return data;
  }

  async function renameStudent(s) {
    const newName = prompt('새 이름:', s.name);
    if (!newName || newName.trim() === s.name) return;
    await manageStudent('update', { id: s.id, name: newName.trim() });
  }

  async function toggleTestFlag(s) {
    if (
      !confirm(
        `${s.name} 을(를) ${
          s.isTest ? '실제 학생' : '테스트 학생'
        }으로 바꿀까요?`
      )
    )
      return;
    await manageStudent('update', { id: s.id, isTest: !s.isTest });
  }

  async function resetPin(s) {
    if (!confirm(`${s.name}의 PIN을 1111로 초기화할까요?`)) return;
    await manageStudent('reset-pin', { id: s.id });
  }

  async function removeStudent(s) {
    if (
      !confirm(
        `${s.name}을(를) 명단에서 삭제할까요?\n(누적 상금도 함께 삭제됩니다)`
      )
    )
      return;
    await manageStudent('delete', { id: s.id });
  }

  async function addNewStudent() {
    const name = newStudentName.trim();
    if (!name) return;
    await manageStudent('add', { name, isTest: newIsTest });
    setNewStudentName('');
    setNewIsTest(false);
  }

  if (loading || !pdState || !payoff || !strategies || !bidState || !bidSettings || !pgState || !pgSettings) {
    return (
      <div className="container">
        <div className="muted">로딩 중…</div>
      </div>
    );
  }

  const totalAssigned = pdState.pairs.flat().length;
  const totalChoices = Object.keys(pdState.choices || {}).length;
  const allChose =
    pdState.status === 'active' &&
    totalAssigned > 0 &&
    totalChoices >= totalAssigned;

  const realStudents = students.filter((s) => !s.isTest);
  const testStudents = students.filter((s) => s.isTest);

  // 게임 1 진행 현황
  const bidSubmittedIds = Object.keys(bidState.bids || {});
  const bidSubmittedRealCount = realStudents.filter((s) =>
    bidSubmittedIds.includes(s.id)
  ).length;
  const bidSubmittedTestCount = testStudents.filter((s) =>
    bidSubmittedIds.includes(s.id)
  ).length;
  const bidStatus = bidState.status || 'idle';
  const allRealBid =
    bidStatus === 'active' &&
    realStudents.length > 0 &&
    bidSubmittedRealCount >= realStudents.length;

  // 게임 3 진행 현황
  const pgStatus = pgState.status || 'idle';
  const pgAssignedIds = (pgState.groups || []).flat();
  const pgContribIds = Object.keys(pgState.contributions || {});
  const pgPunishIds = Object.keys(pgState.punishments || {});
  const pgContribCount = pgAssignedIds.filter((id) =>
    pgContribIds.includes(id)
  ).length;
  const pgPunishCount = pgAssignedIds.filter((id) =>
    pgPunishIds.includes(id)
  ).length;
  const pgAllContrib =
    pgStatus === 'active' &&
    pgAssignedIds.length > 0 &&
    pgContribCount >= pgAssignedIds.length;
  const pgAllPunish =
    pgStatus === 'punishing' &&
    pgAssignedIds.length > 0 &&
    pgPunishCount >= pgAssignedIds.length;
  const pgIsLastRound =
    pgState.currentRound >= (pgSettings.numRounds || 1);

  return (
    <div className="container">
      <div className="header row-between">
        <div>
          <div className="title-kor">관리 페이지</div>
          <div className="subtitle">정치경제철학 개론 — 교수: 신호철</div>
        </div>
      </div>

      {msg && (
        <div className="card" style={{ background: '#e7f0e8' }}>
          {msg}
        </div>
      )}

      {/* ====================================================== */}
      {/* ============ 게임 1: 최저가 입찰 게임 =================== */}
      {/* ====================================================== */}
      <div
        className="card"
        style={{ borderTop: '3px solid var(--gold, #c9a227)' }}
      >
        <div className="row-between">
          <div className="section-title" style={{ marginBottom: 0 }}>
            게임 1 · 최저가 입찰 게임
          </div>
          <span className={`status-badge status-${bidStatus}`}>
            {bidStatus === 'active'
              ? '진행 중'
              : bidStatus === 'completed'
              ? '완료'
              : '대기'}
          </span>
        </div>

        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          가장 작은 숫자를 쓴 학생(들)이 우승. 우승자가 여러 명이면
          본인이 쓴 숫자 ÷ 우승자 수 (소수점 첫째 자리에서 버림).
        </div>

        <div style={{ height: 12 }} />

        {/* 설정 영역 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          <div>
            <label className="label">최소값 (원)</label>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              value={bidSettings.min.toLocaleString('ko-KR')}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, '');
                setBidSettings({
                  ...bidSettings,
                  min: v === '' ? 0 : Number(v),
                });
              }}
              disabled={bidStatus === 'active'}
              style={{ textAlign: 'right' }}
            />
          </div>
          <div>
            <label className="label">최대값 (원)</label>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              value={bidSettings.max.toLocaleString('ko-KR')}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, '');
                setBidSettings({
                  ...bidSettings,
                  max: v === '' ? 0 : Number(v),
                });
              }}
              disabled={bidStatus === 'active'}
              style={{ textAlign: 'right' }}
            />
          </div>
        </div>

        <div style={{ height: 12 }} />
        <label className="label">결과 공개 방식 (학생 화면 기준)</label>
        <div className="row" style={{ gap: 14, alignItems: 'center' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
            }}
          >
            <input
              type="radio"
              name="showWinnerNames"
              checked={!bidSettings.showWinnerNames}
              onChange={() =>
                setBidSettings({ ...bidSettings, showWinnerNames: false })
              }
              disabled={bidStatus === 'active'}
            />
            익명 (이름 비공개)
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
            }}
          >
            <input
              type="radio"
              name="showWinnerNames"
              checked={!!bidSettings.showWinnerNames}
              onChange={() =>
                setBidSettings({ ...bidSettings, showWinnerNames: true })
              }
              disabled={bidStatus === 'active'}
            />
            실명 공개
          </label>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          ※ 최저 숫자는 항상 공개. 우승자 이름만 옵션에 따라 달라집니다.
        </div>

        <div style={{ height: 12 }} />
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button
            className="btn btn-accent"
            onClick={saveBidSetup}
            disabled={bidStatus === 'active'}
          >
            설정 저장
          </button>
          {bidStatus === 'idle' && (
            <button className="btn btn-green" onClick={startBidGame}>
              ▶ 게임 시작
            </button>
          )}
          {bidStatus === 'active' && (
            <button
              className="btn btn-accent"
              onClick={confirmBidGame}
              disabled={bidSubmittedIds.length === 0}
            >
              ✓ 결과 확정 ({bidSubmittedRealCount}/{realStudents.length}
              {bidSubmittedTestCount > 0 ? ` · 테스트 ${bidSubmittedTestCount}` : ''})
            </button>
          )}
          <button className="btn btn-secondary" onClick={resetBidGame}>
            ↺ 초기화
          </button>
        </div>

        {bidStatus === 'active' && !allRealBid && bidSubmittedRealCount > 0 && (
          <div
            className="muted"
            style={{ fontSize: 12, marginTop: 8, color: 'var(--accent)' }}
          >
            ※ 아직 미제출 학생이 있습니다. 모두 제출한 뒤 확정하는 것을
            권장합니다 (강제는 아님).
          </div>
        )}

        {/* 제출 현황 (진행 중) */}
        {bidStatus === 'active' && (
          <>
            <div style={{ height: 14 }} />
            <div
              className="muted"
              style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}
            >
              제출 현황
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 6,
                fontSize: 13,
              }}
            >
              {students.map((s) => {
                const submitted = bidSubmittedIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    style={{
                      padding: '4px 8px',
                      background: submitted ? '#e7f0e8' : '#faf3e0',
                      borderRadius: 4,
                      border: s.isTest ? '1px dashed var(--accent)' : 'none',
                    }}
                  >
                    {submitted ? '✓' : '⏳'} {s.name}
                    {s.isTest && (
                      <span className="muted" style={{ fontSize: 11 }}>
                        {' '}[test]
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 결과 (확정 후) */}
        {bidStatus === 'completed' && bidState.results && (
          <>
            <div style={{ height: 14 }} />
            <div
              className="muted"
              style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}
            >
              결과
            </div>
            <table className="balance-list">
              <tbody>
                <tr>
                  <td>최저 숫자</td>
                  <td className="amount-col">
                    <b>
                      {Number(bidState.results.lowestBid).toLocaleString()}원
                    </b>
                  </td>
                </tr>
                <tr>
                  <td>우승자 수</td>
                  <td className="amount-col">
                    {bidState.results.winnerCount}명
                  </td>
                </tr>
                <tr>
                  <td>1인당 상금</td>
                  <td className="amount-col">
                    <b style={{ color: 'var(--gold)' }}>
                      {Number(
                        bidState.results.prizePerWinner
                      ).toLocaleString()}
                      원
                    </b>
                  </td>
                </tr>
                <tr>
                  <td>우승자</td>
                  <td className="amount-col">
                    {bidState.results.winnerNames.join(', ')}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ height: 12 }} />
            <div
              className="muted"
              style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}
            >
              전체 제출 숫자 (교수만 표시)
            </div>
            <table className="balance-list">
              <thead>
                <tr>
                  <th>학생</th>
                  <th className="amount-col">제출 숫자</th>
                  <th className="amount-col">받은 상금</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(bidState.bids || {})
                  .sort((a, b) => Number(a[1]) - Number(b[1]))
                  .map(([sid, v]) => {
                    const stu = students.find((s) => s.id === sid);
                    const isWinner =
                      bidState.results.winnerIds.includes(sid);
                    return (
                      <tr
                        key={sid}
                        style={
                          isWinner
                            ? { background: '#faf3e0', fontWeight: 600 }
                            : undefined
                        }
                      >
                        <td>
                          {stu?.name || sid}
                          {stu?.isTest && (
                            <span
                              className="muted"
                              style={{ fontSize: 11 }}
                            >
                              {' '}
                              [test]
                            </span>
                          )}
                        </td>
                        <td className="amount-col">
                          {Number(v).toLocaleString()}원
                        </td>
                        <td className="amount-col">
                          {isWinner
                            ? `+${Number(
                                bidState.results.prizePerWinner
                              ).toLocaleString()}원`
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* ====================================================== */}
      {/* ============ 게임 2: 죄수의 딜레마 ===================== */}
      {/* ====================================================== */}

      <div className="card">
        <div className="row-between">
          <div className="section-title" style={{ marginBottom: 0 }}>
            게임 2 · 죄수의 딜레마
          </div>
          <span className={`status-badge status-${pdState.status}`}>
            {pdState.status === 'active'
              ? '진행 중'
              : pdState.status === 'completed'
              ? '완료'
              : '대기'}
          </span>
        </div>
        <div style={{ height: 8 }} />
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {pdState.status === 'idle' && (
            <button
              className="btn btn-green"
              onClick={startGame}
              disabled={pdState.pairs.length === 0}
            >
              ▶ 게임 시작
            </button>
          )}
          {pdState.status === 'active' && (
            <button
              className="btn btn-accent"
              onClick={confirmGame}
              disabled={!allChose}
            >
              ✓ 결과 확정 ({totalChoices}/{totalAssigned})
            </button>
          )}
          {pdState.status === 'completed' && (
            <div className="muted">
              라운드 완료. 새 라운드는 초기화 후 시작.
            </div>
          )}
          <button className="btn btn-secondary" onClick={resetGame}>
            ↺ 초기화
          </button>
        </div>
      </div>

      {/* === 전략 이름 === */}
      <div className="card">
        <div className="section-title">전략 이름</div>
        <div
          className="muted"
          style={{ fontSize: 12, margin: '8px 0' }}
        >
          학생들이 보는 두 가지 선택지의 이름을 자유롭게 정하세요. (예:
          협력/배신, 비둘기/매, A/B …)
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          <div>
            <label className="label">전략 1 (내부 키: D)</label>
            <input
              className="input"
              value={strategies.D}
              onChange={(e) =>
                setStrategies({ ...strategies, D: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">전략 2 (내부 키: R)</label>
            <input
              className="input"
              value={strategies.R}
              onChange={(e) =>
                setStrategies({ ...strategies, R: e.target.value })
              }
            />
          </div>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          ※ 변경 후 아래 짝 편성의 「설정 저장」을 눌러야 학생 화면에
          반영됩니다.
        </div>
      </div>

      {/* === 페이오프 === */}
      <div className="card">
        <div className="section-title">보수 행렬 (단위: 원)</div>
        <div
          className="muted"
          style={{ fontSize: 12, margin: '8px 0' }}
        >
          [학생 1 보수, 학생 2 보수] · 학생 1은 행렬 왼쪽, 학생 2는 위쪽
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          {[
            ['DD', `학생1 ${sLabel('D')} · 학생2 ${sLabel('D')}`],
            ['DR', `학생1 ${sLabel('D')} · 학생2 ${sLabel('R')}`],
            ['RD', `학생1 ${sLabel('R')} · 학생2 ${sLabel('D')}`],
            ['RR', `학생1 ${sLabel('R')} · 학생2 ${sLabel('R')}`],
          ].map(([k, label]) => (
            <div key={k}>
              <label className="label">{label}</label>
              <div className="row">
                <PayoffInput
                  value={payoff[k][0]}
                  onChange={(v) =>
                    setPayoff({ ...payoff, [k]: [v, payoff[k][1]] })
                  }
                />
                <PayoffInput
                  value={payoff[k][1]}
                  onChange={(v) =>
                    setPayoff({ ...payoff, [k]: [payoff[k][0], v] })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* === 짝 편성 === */}
      <div className="card">
        <div className="row-between">
          <div className="section-title" style={{ marginBottom: 0 }}>
            짝 편성
          </div>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: 13 }}
            onClick={autoPair}
          >
            🎲 랜덤 자동 편성
          </button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          왼쪽 = 학생 1 (행) · 오른쪽 = 학생 2 (열)
        </div>
        <div style={{ height: 10 }} />

        {pairs.map((pair, idx) => (
          <div key={idx} className="admin-pair">
            <select
              value={pair[0]}
              onChange={(e) => setPair(idx, 0, e.target.value)}
            >
              <option value="">— 학생 1 —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isTest ? ' [test]' : ''}
                </option>
              ))}
            </select>
            <span style={{ fontWeight: 700 }}>vs</span>
            <select
              value={pair[1]}
              onChange={(e) => setPair(idx, 1, e.target.value)}
            >
              <option value="">— 학생 2 —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isTest ? ' [test]' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => removePair(idx)}
              style={{
                gridColumn: '1 / -1',
                color: 'var(--accent)',
                fontSize: 12,
                marginTop: 4,
              }}
            >
              제거
            </button>
          </div>
        ))}

        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={addPair}>
            + 짝 추가
          </button>
          <button className="btn btn-accent" onClick={setupGame}>
            설정 저장
          </button>
        </div>
      </div>

      {/* === 선택 현황 === */}
      {pdState.status === 'active' && (
        <div className="card">
          <div className="section-title">선택 현황</div>
          <table className="balance-list">
            <thead>
              <tr>
                <th>짝 (학생1 vs 학생2)</th>
                <th>선택</th>
              </tr>
            </thead>
            <tbody>
              {pdState.pairs.map((pair, i) => {
                const a = students.find((s) => s.id === pair[0]);
                const b = students.find((s) => s.id === pair[1]);
                const ca = pdState.choices?.[pair[0]];
                const cb = pdState.choices?.[pair[1]];
                const labelOf = (c) =>
                  c
                    ? `✓ ${pdState.strategies?.[c] || sLabel(c)}`
                    : '⏳ 대기';
                return (
                  <tr key={i}>
                    <td>
                      {a?.name || '?'} vs {b?.name || '?'}
                    </td>
                    <td>
                      {a?.name}: {labelOf(ca)}
                      <br />
                      {b?.name}: {labelOf(cb)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* === 결과 === */}
      {pdState.status === 'completed' && pdState.results && (
        <div className="card">
          <div className="section-title">이번 라운드 결과</div>
          <table className="balance-list">
            <thead>
              <tr>
                <th>학생</th>
                <th>선택</th>
                <th>보수</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(pdState.results).map(([sid, r]) => {
                const s = students.find((x) => x.id === sid);
                return (
                  <tr key={sid}>
                    <td>{s?.name || sid}</td>
                    <td>
                      {pdState.strategies?.[r.myChoice] ||
                        sLabel(r.myChoice)}
                    </td>
                    <td className="amount-col">
                      {r.payoff.toLocaleString()}원
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ====================================================== */}
      {/* ============ 게임 3: 공공재 게임 ===================== */}
      {/* ====================================================== */}
      <div
        className="card"
        style={{ borderTop: '3px solid var(--green)' }}
      >
        <div className="row-between">
          <div className="section-title" style={{ marginBottom: 0 }}>
            게임 3 · 공공재 게임
          </div>
          <span
            className={`status-badge status-${
              pgStatus === 'punishing'
                ? 'active'
                : pgStatus === 'finished'
                ? 'completed'
                : pgStatus
            }`}
          >
            {pgStatus === 'active'
              ? `라운드 ${pgState.currentRound}/${pgSettings.numRounds} 진행 중`
              : pgStatus === 'punishing'
              ? `라운드 ${pgState.currentRound}/${pgSettings.numRounds} 처벌 단계`
              : pgStatus === 'completed'
              ? `라운드 ${pgState.currentRound}/${pgSettings.numRounds} 확정됨`
              : pgStatus === 'finished'
              ? `종료 (${pgSettings.numRounds}라운드)`
              : '대기'}
          </span>
        </div>

        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          그룹별로 협력/배신 결정. {pgSettings.mode === 'discrete'
            ? '이산형 (관개 게임 — 기여/비기여)'
            : `연속형 (실험 — 0~${pgSettings.endowment.toLocaleString()}원 사이 자유 기여, MPCR ${pgSettings.mpcr})`}
          {pgSettings.punishmentEnabled && ' · 처벌 단계 ON'}
        </div>

        <div style={{ height: 12 }} />

        {/* 진행 컨트롤 */}
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {pgStatus === 'idle' && (
            <button
              className="btn btn-green"
              onClick={startPgGame}
              disabled={pgGroups.length === 0}
            >
              ▶ 게임 시작 (라운드 1)
            </button>
          )}
          {pgStatus === 'active' && (
            <>
              {pgSettings.punishmentEnabled ? (
                <button
                  className="btn btn-accent"
                  onClick={revealPgContrib}
                  disabled={pgContribCount === 0}
                >
                  → 기여 공개 / 처벌 단계로 ({pgContribCount}/
                  {pgAssignedIds.length})
                </button>
              ) : (
                <button
                  className="btn btn-accent"
                  onClick={confirmPgRound}
                  disabled={pgContribCount === 0}
                >
                  ✓ 결과 확정 ({pgContribCount}/{pgAssignedIds.length})
                </button>
              )}
            </>
          )}
          {pgStatus === 'punishing' && (
            <button
              className="btn btn-accent"
              onClick={confirmPgRound}
            >
              ✓ 결과 확정 (처벌 {pgPunishCount}/{pgAssignedIds.length})
            </button>
          )}
          {pgStatus === 'completed' && !pgIsLastRound && (
            <button className="btn btn-green" onClick={nextPgRound}>
              ▶ 다음 라운드 시작 (라운드 {pgState.currentRound + 1})
            </button>
          )}
          {pgStatus === 'completed' && pgIsLastRound && (
            <button className="btn btn-accent" onClick={finishPgGame}>
              ■ 게임 종료
            </button>
          )}
          {pgStatus === 'completed' && !pgIsLastRound && (
            <button className="btn btn-secondary" onClick={finishPgGame}>
              ■ 조기 종료
            </button>
          )}
          <button className="btn btn-secondary" onClick={resetPgGame}>
            ↺ 초기화
          </button>
        </div>

        {pgStatus === 'active' && !pgAllContrib && pgContribCount > 0 && (
          <div
            className="muted"
            style={{ fontSize: 12, marginTop: 8, color: 'var(--accent)' }}
          >
            ※ 아직 미제출 학생이 있습니다. 가급적 모두 제출한 뒤 진행하세요.
          </div>
        )}

        {/* 진행 현황 (active 또는 punishing) */}
        {(pgStatus === 'active' || pgStatus === 'punishing') &&
          pgState.groups.length > 0 && (
            <>
              <div style={{ height: 14 }} />
              <div
                className="muted"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                {pgStatus === 'active' ? '기여 제출 현황' : '처벌 제출 현황'}
              </div>
              {pgState.groups.map((g, gIdx) => (
                <div
                  key={gIdx}
                  style={{
                    background: '#faf7f0',
                    padding: 8,
                    borderRadius: 4,
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--ink-soft)',
                      marginBottom: 4,
                    }}
                  >
                    그룹 {gIdx + 1} ({g.length}명)
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 4,
                      fontSize: 13,
                    }}
                  >
                    {g.map((sid) => {
                      const stu = students.find((s) => s.id === sid);
                      const submitted =
                        pgStatus === 'active'
                          ? pgContribIds.includes(sid)
                          : pgPunishIds.includes(sid);
                      const contribLabel =
                        pgStatus === 'punishing' &&
                        pgContribIds.includes(sid)
                          ? pgSettings.mode === 'discrete'
                            ? pgState.contributions[sid] === 'C'
                              ? `(${pgSettings.strategies.C})`
                              : `(${pgSettings.strategies.N})`
                            : `(${Number(pgState.contributions[sid]).toLocaleString()}원)`
                          : '';
                      return (
                        <div
                          key={sid}
                          style={{
                            padding: '3px 6px',
                            background: submitted ? '#e7f0e8' : '#fff',
                            borderRadius: 3,
                            border: stu?.isTest
                              ? '1px dashed var(--accent)'
                              : '1px solid var(--line)',
                          }}
                        >
                          {submitted ? '✓' : '⏳'} {stu?.name || sid}
                          {contribLabel && (
                            <span
                              style={{
                                color: 'var(--ink-soft)',
                                fontSize: 11,
                                marginLeft: 4,
                              }}
                            >
                              {contribLabel}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

        {/* 결과 (completed일 때) */}
        {pgStatus === 'completed' && pgState.results && (
          <>
            <div style={{ height: 14 }} />
            <div
              className="muted"
              style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}
            >
              라운드 {pgState.currentRound} 결과
            </div>
            {pgState.groups.map((g, gIdx) => {
              const groupContrib = g.reduce(
                (acc, sid) =>
                  acc + (pgState.results[sid]?.contribution.contributed ? 1 : 0),
                0
              );
              const groupTotalContrib = g.reduce(
                (acc, sid) =>
                  acc + (pgState.results[sid]?.contribution.amount || 0),
                0
              );
              return (
                <div
                  key={gIdx}
                  style={{
                    background: '#faf7f0',
                    padding: 10,
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    그룹 {gIdx + 1}{' '}
                    <span
                      style={{
                        color: 'var(--ink-soft)',
                        fontWeight: 400,
                      }}
                    >
                      ({g.length}명 · 기여자{' '}
                      {groupContrib}/{g.length}
                      {pgSettings.mode === 'continuous' &&
                        ` · 총 기여 ${groupTotalContrib.toLocaleString()}원`}
                      )
                    </span>
                  </div>
                  <table className="balance-list">
                    <thead>
                      <tr>
                        <th>학생</th>
                        <th>기여</th>
                        {pgSettings.punishmentEnabled && <th>처벌(가/받)</th>}
                        <th className="amount-col">보수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.map((sid) => {
                        const r = pgState.results[sid];
                        const stu = students.find((s) => s.id === sid);
                        if (!r) return null;
                        return (
                          <tr key={sid}>
                            <td>
                              {stu?.name || sid}
                              {stu?.isTest && (
                                <span
                                  className="muted"
                                  style={{ fontSize: 11 }}
                                >
                                  {' '}
                                  [test]
                                </span>
                              )}
                            </td>
                            <td>
                              {pgSettings.mode === 'discrete'
                                ? r.contribution.contributed
                                  ? '✓'
                                  : '—'
                                : `${r.contribution.amount.toLocaleString()}원`}
                            </td>
                            {pgSettings.punishmentEnabled && (
                              <td style={{ fontSize: 13 }}>
                                {r.punishGiven}/{r.punishReceived}
                              </td>
                            )}
                            <td className="amount-col">
                              {r.roundPayoff >= 0 ? '+' : ''}
                              {r.roundPayoff.toLocaleString()}원
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* === PG 설정 === */}
      <div className="card">
        <div className="section-title">게임 3 · 설정</div>

        {/* 모드 토글 */}
        <label className="label" style={{ marginTop: 8 }}>
          게임 모드
        </label>
        <div className="row" style={{ gap: 14 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
            }}
          >
            <input
              type="radio"
              name="pgMode"
              checked={pgSettings.mode === 'discrete'}
              onChange={() =>
                setPgSettings({ ...pgSettings, mode: 'discrete' })
              }
              disabled={pgStatus !== 'idle'}
            />
            이산형 (관개 게임 — 기여/비기여)
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
            }}
          >
            <input
              type="radio"
              name="pgMode"
              checked={pgSettings.mode === 'continuous'}
              onChange={() =>
                setPgSettings({ ...pgSettings, mode: 'continuous' })
              }
              disabled={pgStatus !== 'idle'}
            />
            연속형 (CORE 실험 — 0~endowment 자유 기여)
          </label>
        </div>

        <div style={{ height: 12 }} />

        {/* 환율 + 라운드 수 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          <div>
            <label className="label">환율 (1달러 = ?원, 참고용)</label>
            <PgNumberInput
              value={pgSettings.exchangeRate}
              onChange={(v) =>
                setPgSettings({ ...pgSettings, exchangeRate: v })
              }
              suffix="원"
              disabled={pgStatus !== 'idle'}
            />
          </div>
          <div>
            <label className="label">총 라운드 수</label>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              value={pgSettings.numRounds}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, '');
                setPgSettings({
                  ...pgSettings,
                  numRounds: Math.max(1, v === '' ? 1 : Number(v)),
                });
              }}
              disabled={pgStatus !== 'idle'}
              style={{ textAlign: 'right' }}
            />
          </div>
        </div>

        <div style={{ height: 12 }} />

        {/* 모드별 파라미터 */}
        {pgSettings.mode === 'discrete' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <div>
              <label className="label">기여 비용 C (원)</label>
              <PgNumberInput
                value={pgSettings.cost}
                onChange={(v) => setPgSettings({ ...pgSettings, cost: v })}
                suffix="원"
                disabled={pgStatus !== 'idle'}
              />
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                CORE: $10 → 15,000원
              </div>
            </div>
            <div>
              <label className="label">기여당 인당 편익 B (원)</label>
              <PgNumberInput
                value={pgSettings.benefit}
                onChange={(v) =>
                  setPgSettings({ ...pgSettings, benefit: v })
                }
                suffix="원"
                disabled={pgStatus !== 'idle'}
              />
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                CORE: $8 → 12,000원
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 10,
            }}
          >
            <div>
              <label className="label">Endowment (원)</label>
              <PgNumberInput
                value={pgSettings.endowment}
                onChange={(v) =>
                  setPgSettings({ ...pgSettings, endowment: v })
                }
                suffix="원"
                disabled={pgStatus !== 'idle'}
              />
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                CORE: $20 → 30,000원
              </div>
            </div>
            <div>
              <label className="label">MPCR</label>
              <input
                className="input"
                type="text"
                inputMode="decimal"
                value={pgSettings.mpcr}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d.]/g, '');
                  const n = Number(v);
                  setPgSettings({
                    ...pgSettings,
                    mpcr: Number.isFinite(n) ? n : 0,
                  });
                }}
                disabled={pgStatus !== 'idle'}
                style={{ textAlign: 'right' }}
              />
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                CORE: 0.4
              </div>
            </div>
            <div>
              <label className="label">입력 단위 (원)</label>
              <PgNumberInput
                value={pgSettings.increment}
                onChange={(v) =>
                  setPgSettings({
                    ...pgSettings,
                    increment: Math.max(1, v),
                  })
                }
                suffix="원"
                disabled={pgStatus !== 'idle'}
              />
            </div>
          </div>
        )}

        {/* 전략 라벨 (이산형만) */}
        {pgSettings.mode === 'discrete' && (
          <>
            <div style={{ height: 12 }} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <div>
                <label className="label">전략 1 라벨 (내부: C)</label>
                <input
                  className="input"
                  value={pgSettings.strategies.C}
                  onChange={(e) =>
                    setPgSettings({
                      ...pgSettings,
                      strategies: {
                        ...pgSettings.strategies,
                        C: e.target.value,
                      },
                    })
                  }
                  disabled={pgStatus !== 'idle'}
                />
              </div>
              <div>
                <label className="label">전략 2 라벨 (내부: N)</label>
                <input
                  className="input"
                  value={pgSettings.strategies.N}
                  onChange={(e) =>
                    setPgSettings({
                      ...pgSettings,
                      strategies: {
                        ...pgSettings.strategies,
                        N: e.target.value,
                      },
                    })
                  }
                  disabled={pgStatus !== 'idle'}
                />
              </div>
            </div>
          </>
        )}

        {/* 처벌 옵션 */}
        <div style={{ height: 16 }} />
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            checked={pgSettings.punishmentEnabled}
            onChange={(e) =>
              setPgSettings({
                ...pgSettings,
                punishmentEnabled: e.target.checked,
              })
            }
            disabled={pgStatus !== 'idle'}
          />
          처벌 단계 활성화 (Fehr-Gächter 식)
        </label>
        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
          기여 공개 후 학생들이 비용을 들여 다른 멤버를 처벌할 수 있게 합니다.
        </div>

        {pgSettings.punishmentEnabled && (
          <>
            <div style={{ height: 10 }} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 10,
              }}
            >
              <div>
                <label className="label">포인트당 가해자 비용</label>
                <PgNumberInput
                  value={pgSettings.punishmentCost}
                  onChange={(v) =>
                    setPgSettings({ ...pgSettings, punishmentCost: v })
                  }
                  suffix="원"
                  disabled={pgStatus !== 'idle'}
                />
              </div>
              <div>
                <label className="label">포인트당 피해자 차감</label>
                <PgNumberInput
                  value={pgSettings.punishmentEffect}
                  onChange={(v) =>
                    setPgSettings({ ...pgSettings, punishmentEffect: v })
                  }
                  suffix="원"
                  disabled={pgStatus !== 'idle'}
                />
              </div>
              <div>
                <label className="label">1명당 최대 포인트</label>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  value={pgSettings.punishmentMax}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, '');
                    setPgSettings({
                      ...pgSettings,
                      punishmentMax:
                        v === '' ? 0 : Math.max(0, Number(v)),
                    });
                  }}
                  disabled={pgStatus !== 'idle'}
                  style={{ textAlign: 'right' }}
                />
              </div>
            </div>
          </>
        )}

        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          ※ 설정/그룹 모두 「설정 저장」을 눌러야 학생 화면에 반영됩니다.
          진행 중에는 변경 불가.
        </div>
      </div>

      {/* === PG 그룹 편성 === */}
      <div className="card">
        <div className="row-between">
          <div className="section-title" style={{ marginBottom: 0 }}>
            게임 3 · 그룹 편성
          </div>
          <div className="row" style={{ gap: 6 }}>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              value={autoGroupSize}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, '');
                setAutoGroupSize(v === '' ? 4 : Math.max(2, Number(v)));
              }}
              disabled={pgStatus !== 'idle'}
              style={{
                width: 60,
                padding: '6px 8px',
                fontSize: 13,
                textAlign: 'center',
              }}
            />
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: 13 }}
              onClick={autoMakeGroups}
              disabled={pgStatus !== 'idle'}
            >
              🎲 {autoGroupSize}명씩 랜덤 편성
            </button>
          </div>
        </div>

        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          그룹 크기는 자유롭게 조정 가능 (4·4·5 같이 불균등도 OK). 매 라운드 동일한
          그룹 유지 (partner matching).
        </div>
        <div style={{ height: 10 }} />

        {pgGroups.length === 0 && (
          <div className="muted" style={{ fontSize: 13, padding: 8 }}>
            아직 그룹이 없습니다. 자동 편성 또는 「+ 그룹 추가」를 이용하세요.
          </div>
        )}

        {pgGroups.map((g, gIdx) => (
          <div
            key={gIdx}
            style={{
              background: '#faf7f0',
              padding: 10,
              borderRadius: 4,
              marginBottom: 8,
            }}
          >
            <div className="row-between" style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                그룹 {gIdx + 1} ({g.length}명)
              </div>
              <button
                onClick={() => removePgGroup(gIdx)}
                disabled={pgStatus !== 'idle'}
                style={{
                  color: 'var(--accent)',
                  fontSize: 12,
                  opacity: pgStatus !== 'idle' ? 0.4 : 1,
                }}
              >
                그룹 삭제
              </button>
            </div>
            {g.map((sid, mIdx) => (
              <div
                key={mIdx}
                style={{
                  display: 'flex',
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <select
                  value={sid}
                  onChange={(e) =>
                    setPgMember(gIdx, mIdx, e.target.value)
                  }
                  disabled={pgStatus !== 'idle'}
                  style={{
                    flex: 1,
                    padding: 6,
                    border: '1px solid var(--line)',
                    borderRadius: 4,
                  }}
                >
                  <option value="">— 학생 선택 —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.isTest ? ' [test]' : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removePgMember(gIdx, mIdx)}
                  disabled={pgStatus !== 'idle'}
                  style={{
                    padding: '4px 8px',
                    color: 'var(--accent)',
                    fontSize: 12,
                  }}
                >
                  −
                </button>
              </div>
            ))}
            <button
              onClick={() => addPgMember(gIdx)}
              disabled={pgStatus !== 'idle'}
              style={{
                fontSize: 12,
                color: 'var(--green)',
                marginTop: 4,
              }}
            >
              + 멤버 추가
            </button>
          </div>
        ))}

        <div className="row" style={{ marginTop: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={addPgGroup}
            disabled={pgStatus !== 'idle'}
          >
            + 그룹 추가
          </button>
          <button
            className="btn btn-accent"
            onClick={savePgSetup}
            disabled={pgStatus !== 'idle'}
          >
            설정 저장
          </button>
        </div>
      </div>

      {/* === 학생 명단 관리 === */}
      <div className="card">
        <div className="section-title">학생 명단 / 잔고 관리</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          이름 클릭 = 수정 · +/− = 잔고 조정 · = = 잔고 설정 · ↺ = PIN
          1111로 · T = 테스트 토글 · ✕ = 삭제
        </div>
        <div style={{ height: 10 }} />

        <StudentTable
          title={`실제 학생 (${realStudents.length}명)`}
          students={realStudents}
          onRename={renameStudent}
          onResetPin={resetPin}
          onToggleTest={toggleTestFlag}
          onDelete={removeStudent}
          onAdjust={adjustBalance}
          onSetBalance={setBalanceTo}
        />

        <div style={{ height: 16 }} />

        <StudentTable
          title={`테스트 학생 (${testStudents.length}명)`}
          students={testStudents}
          isTest
          onRename={renameStudent}
          onResetPin={resetPin}
          onToggleTest={toggleTestFlag}
          onDelete={removeStudent}
          onAdjust={adjustBalance}
          onSetBalance={setBalanceTo}
        />

        <div style={{ height: 16 }} />
        <div
          className="muted"
          style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}
        >
          + 학생 추가
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder="이름"
            value={newStudentName}
            onChange={(e) => setNewStudentName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNewStudent()}
          />
          <label
            className="muted"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 13,
              whiteSpace: 'nowrap',
            }}
          >
            <input
              type="checkbox"
              checked={newIsTest}
              onChange={(e) => setNewIsTest(e.target.checked)}
            />
            테스트
          </label>
          <button
            className="btn btn-accent"
            onClick={addNewStudent}
            disabled={!newStudentName.trim()}
          >
            추가
          </button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          ※ 새로 추가된 학생의 PIN은 자동으로 1111. 첫 로그인 시 본인이
          변경.
        </div>
      </div>

      <div className="muted" style={{ fontSize: 12, padding: '20px 0' }}>
        💡 테스트 모드 학생 화면은 <code>/?test=1</code> URL로 접속.
      </div>
    </div>
  );
}

// 천 단위 콤마 + "원" 단위 표시 + 직접 입력 가능한 보수 입력칸
function PayoffInput({ value, onChange }) {
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        className="input"
        type="text"
        inputMode="numeric"
        value={value.toLocaleString('ko-KR')}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d-]/g, '');
          onChange(v === '' || v === '-' ? 0 : Number(v));
        }}
        style={{ paddingRight: 36, textAlign: 'right' }}
      />
      <span
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--ink-soft)',
          fontSize: 14,
          pointerEvents: 'none',
        }}
      >
        원
      </span>
    </div>
  );
}

function StudentTable({
  title,
  students,
  isTest,
  onRename,
  onResetPin,
  onToggleTest,
  onDelete,
  onAdjust,
  onSetBalance,
}) {
  return (
    <>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          marginBottom: 6,
          color: isTest ? 'var(--accent)' : 'var(--ink)',
        }}
      >
        {title}
      </div>
      <table className="balance-list">
        <thead>
          <tr>
            <th>이름</th>
            <th>PIN</th>
            <th className="amount-col">잔고</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr
              key={s.id}
              style={isTest ? { background: '#faf3e0' } : undefined}
            >
              <td>
                <button
                  onClick={() => onRename(s)}
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: 'underline dotted',
                  }}
                >
                  {s.name}
                </button>
                <div className="muted" style={{ fontSize: 11 }}>
                  {s.id}
                </div>
              </td>
              <td className="muted">
                {s.pin === '1111' ? (
                  <span style={{ color: 'var(--accent)' }}>1111 (기본)</span>
                ) : (
                  '••••'
                )}
              </td>
              <td className="amount-col">
                {(s.balance || 0).toLocaleString()}원
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button
                  onClick={() => onAdjust(s.id, 1)}
                  title="추가"
                  style={btnSm}
                >
                  +
                </button>
                <button
                  onClick={() => onAdjust(s.id, -1)}
                  title="차감"
                  style={btnSm}
                >
                  −
                </button>
                <button
                  onClick={() => onSetBalance(s.id, s.balance || 0)}
                  title="설정"
                  style={btnSm}
                >
                  =
                </button>
                <button
                  onClick={() => onResetPin(s)}
                  title="PIN 초기화"
                  style={btnSm}
                >
                  ↺
                </button>
                <button
                  onClick={() => onToggleTest(s)}
                  title="테스트 토글"
                  style={btnSm}
                >
                  T
                </button>
                <button
                  onClick={() => onDelete(s)}
                  title="삭제"
                  style={{ ...btnSm, color: 'var(--accent)' }}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {students.length === 0 && (
            <tr>
              <td
                colSpan="4"
                className="muted"
                style={{ textAlign: 'center', padding: 16 }}
              >
                없음
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

// 천 단위 콤마 + 단위(suffix) 표시 + 직접 입력 가능. PG 설정에서 사용.
function PgNumberInput({ value, onChange, suffix = '원', disabled = false }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        type="text"
        inputMode="numeric"
        value={Number(value || 0).toLocaleString('ko-KR')}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d]/g, '');
          onChange(v === '' ? 0 : Number(v));
        }}
        disabled={disabled}
        style={{ paddingRight: 36, textAlign: 'right' }}
      />
      <span
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--ink-soft)',
          fontSize: 14,
          pointerEvents: 'none',
        }}
      >
        {suffix}
      </span>
    </div>
  );
}

const btnSm = {
  marginRight: 2,
  padding: '2px 6px',
  fontSize: 12,
  border: '1px solid var(--line)',
  borderRadius: 3,
  background: '#fff',
};

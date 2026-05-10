'use client';
import { useEffect, useState } from 'react';

export default function AdminPage({ params }) {
  const { secret } = params;
  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState('');
  const [authError, setAuthError] = useState('');

  // 로그인
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
    // 세션에 토큰이 있으면 자동 인증 시도
    const token = sessionStorage.getItem('admin-token');
    if (token) {
      fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, token }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.ok) setAuthed(true); });
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
          <button className="btn btn-block btn-accent" onClick={login}>로그인</button>
        </div>
      </div>
    );
  }

  return <AdminDashboard secret={secret} />;
}

function AdminDashboard({ secret }) {
  const [students, setStudents] = useState([]);
  const [pdState, setPdState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // 페어 편집용 임시 상태
  const [pairs, setPairs] = useState([]);
  // 페이오프 편집용
  const [payoff, setPayoff] = useState(null);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin-token') : '';

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-Admin-Token': token || '',
    };
  }

  async function refresh() {
    const [r1, r2] = await Promise.all([
      fetch(`/api/admin/students?secret=${secret}`, { headers: authHeaders() }).then((r) => r.json()),
      fetch('/api/pd/state').then((r) => r.json()),
    ]);
    if (r1.ok) setStudents(r1.students);
    if (r2.ok) {
      setPdState(r2.state);
      if (r2.state.pairs?.length && pairs.length === 0) setPairs(r2.state.pairs);
      if (r2.state.payoff && !payoff) setPayoff(r2.state.payoff);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  // 페어 자동 생성 (랜덤)
  function autoPair() {
    const ids = students.map((s) => s.id);
    // Fisher-Yates
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const newPairs = [];
    for (let i = 0; i < ids.length - 1; i += 2) {
      newPairs.push([ids[i], ids[i + 1]]);
    }
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
    setMsg('');
    // 빈 페어 제거
    const cleaned = pairs.filter((p) => p[0] && p[1] && p[0] !== p[1]);
    const res = await fetch('/api/admin/pd/setup', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret, pairs: cleaned, payoff }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 설정 저장됨' : `오류: ${data.error}`);
    refresh();
  }

  async function startGame() {
    setMsg('');
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
    if (!confirm('확정하면 보수가 모든 학생의 잔고에 반영됩니다. 진행할까요?')) return;
    setMsg('');
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
    if (!confirm('게임 상태를 초기화합니다 (잔고는 유지). 계속할까요?')) return;
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

  async function adjustBalance(studentId, delta) {
    const amt = prompt(`${delta > 0 ? '추가' : '차감'}할 금액(원)을 입력하세요`, '1000');
    if (!amt) return;
    const n = parseInt(amt, 10);
    if (isNaN(n)) return;
    const res = await fetch('/api/admin/balance', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ secret, studentId, amount: delta * n }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 잔고 조정됨' : `오류: ${data.error}`);
    refresh();
  }

  async function setBalanceTo(studentId, currentBalance) {
    const amt = prompt(`${studentId}의 잔고를 얼마로 설정할까요?`, String(currentBalance));
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

  if (loading || !pdState || !payoff) {
    return <div className="container"><div className="muted">로딩 중…</div></div>;
  }

  // 모든 학생이 선택 제출했는지
  const totalAssigned = pdState.pairs.flat().length;
  const totalChoices = Object.keys(pdState.choices || {}).length;
  const allChose = pdState.status === 'active' && totalAssigned > 0 && totalChoices >= totalAssigned;

  return (
    <div className="container">
      <div className="header row-between">
        <div>
          <div className="title-kor">관리 페이지</div>
          <div className="subtitle">정치경제철학 개론 — 교수: 신호철</div>
        </div>
        <span className={`status-badge status-${pdState.status}`}>
          {pdState.status === 'active' ? '진행 중' : pdState.status === 'completed' ? '완료' : '대기'}
        </span>
      </div>

      {msg && <div className="card" style={{ background: '#e7f0e8' }}>{msg}</div>}

      {/* === 게임 컨트롤 === */}
      <div className="card">
        <div className="section-title">죄수의 딜레마</div>
        <div style={{ height: 8 }} />

        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {pdState.status === 'idle' && (
            <button className="btn btn-green" onClick={startGame} disabled={pdState.pairs.length === 0}>
              ▶ 게임 시작
            </button>
          )}
          {pdState.status === 'active' && (
            <button className="btn btn-accent" onClick={confirmGame} disabled={!allChose}>
              ✓ 결과 확정 ({totalChoices}/{totalAssigned})
            </button>
          )}
          {pdState.status === 'completed' && (
            <div className="muted">라운드 완료. 새 라운드를 시작하려면 초기화하세요.</div>
          )}
          <button className="btn btn-secondary" onClick={resetGame}>↺ 초기화</button>
        </div>
      </div>

      {/* === 페이오프 행렬 편집 === */}
      <div className="card">
        <div className="section-title">보수 행렬 (단위: 원)</div>
        <div className="muted" style={{ fontSize: 12, margin: '8px 0' }}>
          [행 학생 보수, 열 학생 보수]
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            ['DD', '둘 다 부인 (D, D)'],
            ['DR', '행 부인, 열 고발 (D, R)'],
            ['RD', '행 고발, 열 부인 (R, D)'],
            ['RR', '둘 다 고발 (R, R)'],
          ].map(([k, label]) => (
            <div key={k}>
              <label className="label">{label}</label>
              <div className="row">
                <input
                  className="input"
                  type="number"
                  value={payoff[k][0]}
                  onChange={(e) => setPayoff({ ...payoff, [k]: [Number(e.target.value), payoff[k][1]] })}
                />
                <input
                  className="input"
                  type="number"
                  value={payoff[k][1]}
                  onChange={(e) => setPayoff({ ...payoff, [k]: [payoff[k][0], Number(e.target.value)] })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* === 짝 편성 === */}
      <div className="card">
        <div className="row-between">
          <div className="section-title" style={{ marginBottom: 0 }}>짝 편성</div>
          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 13 }} onClick={autoPair}>
            🎲 랜덤 자동 편성
          </button>
        </div>
        <div style={{ height: 10 }} />

        {pairs.map((pair, idx) => (
          <div key={idx} className="admin-pair">
            <select value={pair[0]} onChange={(e) => setPair(idx, 0, e.target.value)}>
              <option value="">— 행 학생 —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <span style={{ fontWeight: 700 }}>vs</span>
            <select value={pair[1]} onChange={(e) => setPair(idx, 1, e.target.value)}>
              <option value="">— 열 학생 —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button onClick={() => removePair(idx)} style={{ gridColumn: '1 / -1', color: 'var(--accent)', fontSize: 12, marginTop: 4 }}>
              제거
            </button>
          </div>
        ))}

        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={addPair}>+ 짝 추가</button>
          <button className="btn btn-accent" onClick={setupGame}>설정 저장</button>
        </div>
      </div>

      {/* === 선택 현황 === */}
      {pdState.status === 'active' && (
        <div className="card">
          <div className="section-title">선택 현황</div>
          <table className="balance-list">
            <thead>
              <tr><th>짝</th><th>선택</th></tr>
            </thead>
            <tbody>
              {pdState.pairs.map((pair, i) => {
                const a = students.find((s) => s.id === pair[0]);
                const b = students.find((s) => s.id === pair[1]);
                const ca = pdState.choices?.[pair[0]];
                const cb = pdState.choices?.[pair[1]];
                return (
                  <tr key={i}>
                    <td>{a?.name || '?'} vs {b?.name || '?'}</td>
                    <td>
                      {a?.name}: {ca === 'D' ? '✓ 부인' : ca === 'R' ? '✓ 고발' : '⏳ 대기'}
                      <br />
                      {b?.name}: {cb === 'D' ? '✓ 부인' : cb === 'R' ? '✓ 고발' : '⏳ 대기'}
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
            <thead><tr><th>학생</th><th>선택</th><th>보수</th></tr></thead>
            <tbody>
              {Object.entries(pdState.results).map(([sid, r]) => {
                const s = students.find((x) => x.id === sid);
                return (
                  <tr key={sid}>
                    <td>{s?.name || sid}</td>
                    <td>{r.myChoice === 'D' ? '부인' : '고발'}</td>
                    <td className="amount-col">{r.payoff.toLocaleString()}원</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* === 학생 잔고 === */}
      <div className="card">
        <div className="section-title">학생 누적 상금</div>
        <table className="balance-list">
          <thead><tr><th>이름</th><th>PIN</th><th className="amount-col">누적 상금</th><th></th></tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="muted">{s.pin}</td>
                <td className="amount-col">{(s.balance || 0).toLocaleString()}원</td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => adjustBalance(s.id, 1)} style={{ marginRight: 4, fontSize: 12 }}>+</button>
                  <button onClick={() => adjustBalance(s.id, -1)} style={{ marginRight: 4, fontSize: 12 }}>−</button>
                  <button onClick={() => setBalanceTo(s.id, s.balance || 0)} style={{ fontSize: 12 }}>=</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          + : 추가 / − : 차감 / = : 직접 설정
        </div>
      </div>
    </div>
  );
}

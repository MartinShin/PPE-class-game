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
  const [pairs, setPairs] = useState([]);
  const [payoff, setPayoff] = useState(null);
  const [strategies, setStrategies] = useState(null);

  const [newStudentName, setNewStudentName] = useState('');
  const [newIsTest, setNewIsTest] = useState(false);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin-token') : '';

  function authHeaders() {
    return { 'Content-Type': 'application/json', 'X-Admin-Token': token || '' };
  }

  // 동적 전략 라벨 (편집 중에도 즉시 반영하기 위해 admin 로컬 strategies 사용)
  const sLabel = (key) => strategies?.[key] || (key === 'D' ? '부인' : '고발');

  async function refresh() {
    const [r1, r2] = await Promise.all([
      fetch(`/api/admin/students?secret=${secret}`, { headers: authHeaders() }).then((r) => r.json()),
      fetch('/api/pd/state').then((r) => r.json()),
    ]);
    if (r1.ok) setStudents(r1.students);
    if (r2.ok) {
      setPdState(r2.state);
      // 사용자가 편집 중일 수 있으므로 처음 한 번만 서버 값으로 채움
      setPairs((prev) => (prev.length === 0 && r2.state.pairs?.length ? r2.state.pairs : prev));
      setPayoff((prev) => prev || r2.state.payoff || null);
      setStrategies((prev) => prev || r2.state.strategies || { D: '부인', R: '고발' });
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  // ---------- 게임 컨트롤 ----------
  function autoPair() {
    const ids = students.filter((s) => !s.isTest).map((s) => s.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const newPairs = [];
    for (let i = 0; i < ids.length - 1; i += 2) newPairs.push([ids[i], ids[i + 1]]);
    setPairs(newPairs);
  }

  function setPair(idx, slot, value) {
    const next = pairs.map((p, i) => (i === idx ? [...p] : p));
    next[idx][slot] = value;
    setPairs(next);
  }
  function addPair() { setPairs([...pairs, ['', '']]); }
  function removePair(idx) { setPairs(pairs.filter((_, i) => i !== idx)); }

  async function setupGame() {
    const cleaned = pairs.filter((p) => p[0] && p[1] && p[0] !== p[1]);
    const res = await fetch('/api/admin/pd/setup', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ secret, pairs: cleaned, payoff, strategies }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 설정 저장됨' : `오류: ${data.error}`);
    refresh();
  }

  async function startGame() {
    const res = await fetch('/api/admin/pd/start', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 게임 시작' : `오류: ${data.error}`);
    refresh();
  }

  async function confirmGame() {
    if (!confirm('확정하면 보수가 모든 학생의 잔고에 반영됩니다. 진행할까요?')) return;
    const res = await fetch('/api/admin/pd/confirm', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 확정 완료. 잔고 반영됨' : `오류: ${data.error}`);
    refresh();
  }

  async function resetGame() {
    if (!confirm('게임 상태를 초기화합니다 (잔고는 유지). 계속할까요?')) return;
    const res = await fetch('/api/admin/pd/reset', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 초기화됨' : `오류: ${data.error}`);
    setPairs([]);
    refresh();
  }

  // ---------- 잔고 ----------
  async function adjustBalance(studentId, delta) {
    const amt = prompt(`${delta > 0 ? '추가' : '차감'}할 금액(원)을 입력하세요`, '1000');
    if (!amt) return;
    const n = parseInt(amt, 10);
    if (isNaN(n)) return;
    const res = await fetch('/api/admin/balance', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ secret, studentId, amount: delta * n }),
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
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ secret, studentId, set: n }),
    });
    const data = await res.json();
    setMsg(data.ok ? '✓ 잔고 설정됨' : `오류: ${data.error}`);
    refresh();
  }

  // ---------- 학생 관리 ----------
  async function manageStudent(action, payload = {}) {
    const res = await fetch('/api/admin/students/manage', {
      method: 'POST', headers: authHeaders(),
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
    if (!confirm(`${s.name} 을(를) ${s.isTest ? '실제 학생' : '테스트 학생'}으로 바꿀까요?`)) return;
    await manageStudent('update', { id: s.id, isTest: !s.isTest });
  }

  async function resetPin(s) {
    if (!confirm(`${s.name}의 PIN을 1111로 초기화할까요?`)) return;
    await manageStudent('reset-pin', { id: s.id });
  }

  async function removeStudent(s) {
    if (!confirm(`${s.name}을(를) 명단에서 삭제할까요?\n(누적 상금도 함께 삭제됩니다)`)) return;
    await manageStudent('delete', { id: s.id });
  }

  async function addNewStudent() {
    const name = newStudentName.trim();
    if (!name) return;
    await manageStudent('add', { name, isTest: newIsTest });
    setNewStudentName('');
    setNewIsTest(false);
  }

  if (loading || !pdState || !payoff || !strategies) {
    return <div className="container"><div className="muted">로딩 중…</div></div>;
  }

  const totalAssigned = pdState.pairs.flat().length;
  const totalChoices = Object.keys(pdState.choices || {}).length;
  const allChose = pdState.status === 'active' && totalAssigned > 0 && totalChoices >= totalAssigned;

  const realStudents = students.filter((s) => !s.isTest);
  const testStudents = students.filter((s) => s.isTest);

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
            <div className="muted">라운드 완료. 새 라운드는 초기화 후 시작.</div>
          )}
          <button className="btn btn-secondary" onClick={resetGame}>↺ 초기화</button>
        </div>
      </div>

      {/* === 전략 이름 === */}
      <div className="card">
        <div className="section-title">전략 이름</div>
        <div className="muted" style={{ fontSize: 12, margin: '8px 0' }}>
          학생들이 보는 두 가지 선택지의 이름을 자유롭게 정하세요. (예: 협력/배신, 비둘기/매, A/B …)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="label">전략 1 (내부 키: D)</label>
            <input
              className="input"
              value={strategies.D}
              onChange={(e) => setStrategies({ ...strategies, D: e.target.value })}
            />
          </div>
          <div>
            <label className="label">전략 2 (내부 키: R)</label>
            <input
              className="input"
              value={strategies.R}
              onChange={(e) => setStrategies({ ...strategies, R: e.target.value })}
            />
          </div>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          ※ 변경 후 아래 짝 편성의 「설정 저장」을 눌러야 학생 화면에 반영됩니다.
        </div>
      </div>

      {/* === 페이오프 (직접 입력 + 원 단위) === */}
      <div className="card">
        <div className="section-title">보수 행렬 (단위: 원)</div>
        <div className="muted" style={{ fontSize: 12, margin: '8px 0' }}>
          [학생 1 보수, 학생 2 보수] · 학생 1은 행렬 왼쪽, 학생 2는 위쪽
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
                  onChange={(v) => setPayoff({ ...payoff, [k]: [v, payoff[k][1]] })}
                />
                <PayoffInput
                  value={payoff[k][1]}
                  onChange={(v) => setPayoff({ ...payoff, [k]: [payoff[k][0], v] })}
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
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          왼쪽 = 학생 1 (행) · 오른쪽 = 학생 2 (열)
        </div>
        <div style={{ height: 10 }} />

        {pairs.map((pair, idx) => (
          <div key={idx} className="admin-pair">
            <select value={pair[0]} onChange={(e) => setPair(idx, 0, e.target.value)}>
              <option value="">— 학생 1 —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.isTest ? ' [test]' : ''}
                </option>
              ))}
            </select>
            <span style={{ fontWeight: 700 }}>vs</span>
            <select value={pair[1]} onChange={(e) => setPair(idx, 1, e.target.value)}>
              <option value="">— 학생 2 —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.isTest ? ' [test]' : ''}
                </option>
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
              <tr><th>짝 (학생1 vs 학생2)</th><th>선택</th></tr>
            </thead>
            <tbody>
              {pdState.pairs.map((pair, i) => {
                const a = students.find((s) => s.id === pair[0]);
                const b = students.find((s) => s.id === pair[1]);
                const ca = pdState.choices?.[pair[0]];
                const cb = pdState.choices?.[pair[1]];
                const labelOf = (c) => c ? `✓ ${pdState.strategies?.[c] || sLabel(c)}` : '⏳ 대기';
                return (
                  <tr key={i}>
                    <td>{a?.name || '?'} vs {b?.name || '?'}</td>
                    <td>
                      {a?.name}: {labelOf(ca)}<br />
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
            <thead><tr><th>학생</th><th>선택</th><th>보수</th></tr></thead>
            <tbody>
              {Object.entries(pdState.results).map(([sid, r]) => {
                const s = students.find((x) => x.id === sid);
                return (
                  <tr key={sid}>
                    <td>{s?.name || sid}</td>
                    <td>{pdState.strategies?.[r.myChoice] || sLabel(r.myChoice)}</td>
                    <td className="amount-col">{r.payoff.toLocaleString()}원</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* === 학생 명단 관리 === */}
      <div className="card">
        <div className="section-title">학생 명단 / 잔고 관리</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          이름 클릭 = 수정 · +/− = 잔고 조정 · = = 잔고 설정 · ↺ = PIN 1111로 · T = 테스트 토글 · ✕ = 삭제
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
        <div className="muted" style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>+ 학생 추가</div>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder="이름"
            value={newStudentName}
            onChange={(e) => setNewStudentName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNewStudent()}
          />
          <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={newIsTest} onChange={(e) => setNewIsTest(e.target.checked)} />
            테스트
          </label>
          <button className="btn btn-accent" onClick={addNewStudent} disabled={!newStudentName.trim()}>
            추가
          </button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          ※ 새로 추가된 학생의 PIN은 자동으로 1111. 첫 로그인 시 본인이 변경.
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
      <span style={{
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        color: 'var(--ink-soft)', fontSize: 14, pointerEvents: 'none',
      }}>원</span>
    </div>
  );
}

function StudentTable({ title, students, isTest, onRename, onResetPin, onToggleTest, onDelete, onAdjust, onSetBalance }) {
  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: isTest ? 'var(--accent)' : 'var(--ink)' }}>
        {title}
      </div>
      <table className="balance-list">
        <thead>
          <tr><th>이름</th><th>PIN</th><th className="amount-col">잔고</th><th></th></tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} style={isTest ? { background: '#faf3e0' } : undefined}>
              <td>
                <button onClick={() => onRename(s)} style={{ fontSize: 14, fontWeight: 600, textDecoration: 'underline dotted' }}>
                  {s.name}
                </button>
                <div className="muted" style={{ fontSize: 11 }}>{s.id}</div>
              </td>
              <td className="muted">
                {s.pin === '1111' ? <span style={{ color: 'var(--accent)' }}>1111 (기본)</span> : '••••'}
              </td>
              <td className="amount-col">{(s.balance || 0).toLocaleString()}원</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button onClick={() => onAdjust(s.id, 1)} title="추가" style={btnSm}>+</button>
                <button onClick={() => onAdjust(s.id, -1)} title="차감" style={btnSm}>−</button>
                <button onClick={() => onSetBalance(s.id, s.balance || 0)} title="설정" style={btnSm}>=</button>
                <button onClick={() => onResetPin(s)} title="PIN 초기화" style={btnSm}>↺</button>
                <button onClick={() => onToggleTest(s)} title="테스트 토글" style={btnSm}>T</button>
                <button onClick={() => onDelete(s)} title="삭제" style={{ ...btnSm, color: 'var(--accent)' }}>✕</button>
              </td>
            </tr>
          ))}
          {students.length === 0 && (
            <tr><td colSpan="4" className="muted" style={{ textAlign: 'center', padding: 16 }}>없음</td></tr>
          )}
        </tbody>
      </table>
    </>
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

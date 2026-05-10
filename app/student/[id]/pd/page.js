'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PrisonersDilemma({ params }) {
  const { id } = params;
  const [pdState, setPdState] = useState(null);
  const [me, setMe] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    const [r1, r2] = await Promise.all([
      fetch('/api/pd/state').then((r) => r.json()),
      fetch(`/api/student/${id}`).then((r) => r.json()),
    ]);
    if (r1.ok) {
      setPdState(r1.state);
      if (r1.state.choices?.[id]) {
        setMyChoice(r1.state.choices[id]);
      }
    }
    if (r2.ok) setMe(r2.student);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!pdState || !me) return;
    const pair = pdState.pairs?.find((p) => p.includes(id));
    if (pair) {
      const oppId = pair[0] === id ? pair[1] : pair[0];
      const myRole = pair[0] === id ? 'p1' : 'p2';
      fetch(`/api/student/${oppId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setOpponent({ ...d.student, myRole });
        });
    }
  }, [pdState, me, id]);

  async function submitChoice(choice) {
    if (myChoice) return;
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/pd/choice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: id, choice }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.ok) {
      setMyChoice(choice);
    } else {
      setError(data.error || '제출 실패');
    }
  }

  if (!pdState || !me) {
    return <div className="container"><div className="muted">로딩 중…</div></div>;
  }

  // 전략 라벨 (서버 상태에서 가져옴, 없으면 기본값)
  const strat = pdState.strategies || { D: '부인', R: '고발' };

  if (pdState.status === 'completed') {
    return (
      <div className="container">
        <div className="card">
          <div className="muted">라운드가 완료되었습니다.</div>
          <Link href={`/student/${id}`} className="btn btn-block btn-accent" style={{ marginTop: 12 }}>
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  if (pdState.status !== 'active' || !opponent) {
    return (
      <div className="container">
        <div className="card">
          <div className="muted">현재 진행 중인 게임이 없거나, 짝이 배정되지 않았습니다.</div>
          <Link href={`/student/${id}`} className="btn btn-block btn-secondary" style={{ marginTop: 12 }}>
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const payoff = pdState.payoff;
  const myLabel = opponent.myRole === 'p1' ? '학생 1' : '학생 2';
  const oppLabel = opponent.myRole === 'p1' ? '학생 2' : '학생 1';

  return (
    <div className="container">
      <div className="header">
        <div className="title-kor">죄수의 딜레마</div>
        <div className="subtitle">{me.name} · 누적 {me.balance.toLocaleString()}원</div>
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 6 }}>
          <div className="muted">상대방</div>
          <span className="role-badge">나는 {myLabel}</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{opponent.name}</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          {opponent.name}: {oppLabel}
        </div>
      </div>

      <div className="card">
        <div className="section-title">보수 행렬</div>
        <div className="muted" style={{ fontSize: 12, margin: '8px 0' }}>
          왼쪽 위: 학생 1 보수 (초록) · 오른쪽 아래: 학생 2 보수 (빨강) · 단위: 원
        </div>
        <table className="payoff-table">
          <thead>
            <tr>
              <th className="corner" rowSpan="2"></th>
              <th colSpan="2">학생 2</th>
            </tr>
            <tr>
              <th>{strat.D}</th>
              <th>{strat.R}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th style={{ background: '#f0ebe0' }}>학생 1<br/>{strat.D}</th>
              <td className="payoff-cell">
                <div className="diag" />
                <div className="row-val">{payoff.DD[0].toLocaleString()}</div>
                <div className="col-val">{payoff.DD[1].toLocaleString()}</div>
              </td>
              <td className="payoff-cell">
                <div className="diag" />
                <div className="row-val">{payoff.DR[0].toLocaleString()}</div>
                <div className="col-val">{payoff.DR[1].toLocaleString()}</div>
              </td>
            </tr>
            <tr>
              <th style={{ background: '#f0ebe0' }}>학생 1<br/>{strat.R}</th>
              <td className="payoff-cell">
                <div className="diag" />
                <div className="row-val">{payoff.RD[0].toLocaleString()}</div>
                <div className="col-val">{payoff.RD[1].toLocaleString()}</div>
              </td>
              <td className="payoff-cell">
                <div className="diag" />
                <div className="row-val">{payoff.RR[0].toLocaleString()}</div>
                <div className="col-val">{payoff.RR[1].toLocaleString()}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="section-title">선택</div>
        <div className="muted" style={{ marginTop: 8 }}>
          {myChoice
            ? '제출 완료. 변경할 수 없습니다.'
            : '한번 누르면 변경할 수 없으니 신중히 선택하세요.'}
        </div>
        <div className="choice-buttons">
          <button
            className={`choice-btn ${myChoice === 'D' ? 'active-deny' : ''}`}
            onClick={() => submitChoice('D')}
            disabled={!!myChoice || submitting}
          >
            {strat.D}
          </button>
          <button
            className={`choice-btn ${myChoice === 'R' ? 'active-report' : ''}`}
            onClick={() => submitChoice('R')}
            disabled={!!myChoice || submitting}
          >
            {strat.R}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      {myChoice && (
        <div className="card" style={{ background: '#e7f0e8', borderColor: 'var(--green)' }}>
          <div style={{ fontWeight: 700, color: 'var(--green)' }}>
            ✓ 선택 제출됨: {strat[myChoice]}
          </div>
          <div className="muted" style={{ marginTop: 4 }}>
            상대방과 교수님의 확정을 기다리는 중입니다.
          </div>
        </div>
      )}

      <div style={{ height: 16 }} />
      <Link href={`/student/${id}`} className="btn btn-block btn-secondary">
        대시보드로
      </Link>
    </div>
  );
}

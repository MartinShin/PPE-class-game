'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PrisonersDilemma({ params }) {
  const { id } = params;
  const router = useRouter();
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
      // 내 선택을 서버 상태에서 가져오기 (재접속 시 유지)
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

  // 짝과 역할 결정
  useEffect(() => {
    if (!pdState || !me) return;
    const pair = pdState.pairs?.find((p) => p.includes(id));
    if (pair) {
      const oppId = pair[0] === id ? pair[1] : pair[0];
      fetch(`/api/student/${oppId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            // 행/열 결정: pair 배열에서 첫번째가 행(row), 두번째가 열(col)
            const myRole = pair[0] === id ? 'row' : 'col';
            setOpponent({ ...d.student, role: myRole === 'row' ? 'col' : 'row', myRole });
          }
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

  // 게임 종료된 경우
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

  // 게임 비활성/짝 없음
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
  // 내 시점에서 보수 표를 보여줄 때, 행/열 위치는 그대로 유지하되
  // 내가 row이면 row의 보수가 내 보수, 내가 col이면 col의 보수가 내 보수
  const myRoleLabel = opponent.myRole === 'row' ? '행 (Row)' : '열 (Column)';
  const oppRoleLabel = opponent.myRole === 'row' ? '열 (Column)' : '행 (Row)';

  return (
    <div className="container">
      <div className="header">
        <div className="title-kor">죄수의 딜레마</div>
        <div className="subtitle">{me.name} · 누적 {me.balance.toLocaleString()}원</div>
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 6 }}>
          <div className="muted">상대방</div>
          <span className="role-badge">나는 {myRoleLabel}</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{opponent.name}</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          {opponent.name} 학생은 {oppRoleLabel}
        </div>
      </div>

      <div className="card">
        <div className="section-title">보수 행렬</div>
        <div className="muted" style={{ fontSize: 12, margin: '8px 0' }}>
          왼쪽 위: 행 학생 보수 (초록) · 오른쪽 아래: 열 학생 보수 (빨강) · 단위: 원
        </div>
        <table className="payoff-table">
          <thead>
            <tr>
              <th className="corner" rowSpan="2"></th>
              <th colSpan="2">열 (Column) 학생</th>
            </tr>
            <tr>
              <th>부인 (Deny)</th>
              <th>고발 (Report)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th style={{ background: '#f0ebe0' }}>행 부인</th>
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
              <th style={{ background: '#f0ebe0' }}>행 고발</th>
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
            부인<br />
            <span style={{ fontSize: 13, fontWeight: 400, opacity: 0.8 }}>(Deny)</span>
          </button>
          <button
            className={`choice-btn ${myChoice === 'R' ? 'active-report' : ''}`}
            onClick={() => submitChoice('R')}
            disabled={!!myChoice || submitting}
          >
            고발<br />
            <span style={{ fontSize: 13, fontWeight: 400, opacity: 0.8 }}>(Report)</span>
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      {myChoice && (
        <div className="card" style={{ background: '#e7f0e8', borderColor: 'var(--green)' }}>
          <div style={{ fontWeight: 700, color: 'var(--green)' }}>
            ✓ 선택 제출됨: {myChoice === 'D' ? '부인' : '고발'}
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

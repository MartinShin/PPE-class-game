'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function StudentDashboard({ params }) {
  const { id } = params;
  const [me, setMe] = useState(null);
  const [pdState, setPdState] = useState(null);

  async function refresh() {
    const r1 = await fetch(`/api/student/${id}`);
    const d1 = await r1.json();
    if (d1.ok) setMe(d1.student);

    const r2 = await fetch('/api/pd/state');
    const d2 = await r2.json();
    if (d2.ok) setPdState(d2.state);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  if (!me) return <div className="container"><div className="muted">로딩 중…</div></div>;

  const myPair = pdState?.pairs?.find((p) => p.includes(id));
  const isInGame = pdState?.status === 'active' && !!myPair;
  const myResult = pdState?.status === 'completed' && pdState?.results?.[id];

  return (
    <div className="container">
      <div className="header row-between">
        <div>
          <div className="title-kor">{me.name}</div>
          <div className="subtitle">정치경제철학 개론 · 2026 봄</div>
        </div>
        <Link href="/" className="muted" style={{ textDecoration: 'underline' }}>
          로그아웃
        </Link>
      </div>

      <div className="balance-display">
        <div className="balance-label">누적 상금</div>
        <div className="balance-amount">{me.balance.toLocaleString()}</div>
        <div className="balance-unit">원</div>
      </div>

      <div style={{ height: 28 }} />

      <div className="section-title">게임</div>
      <div style={{ height: 8 }} />

      <div className="card">
        <div className="row-between">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>죄수의 딜레마</div>
            <div className="muted" style={{ marginTop: 2 }}>2인 동시 선택 게임</div>
          </div>
          <span className={`status-badge status-${pdState?.status || 'idle'}`}>
            {pdState?.status === 'active' ? '진행 중' :
             pdState?.status === 'completed' ? '완료' : '대기'}
          </span>
        </div>

        <div style={{ height: 14 }} />

        {!isInGame && !myResult && (
          <div className="muted">
            교수님이 게임을 시작하면 이 자리에 입장 버튼이 나타납니다.
          </div>
        )}

        {isInGame && pdState.choices?.[id] && (
          <div className="success">
            ✓ 선택을 제출했습니다. 상대방과 교수님의 확정을 기다리는 중…
          </div>
        )}

        {isInGame && !pdState.choices?.[id] && (
          <Link href={`/student/${id}/pd`} className="btn btn-block btn-accent">
            게임 입장
          </Link>
        )}

        {myResult && (
          <div>
            <div className="muted">이번 라운드 결과</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)', margin: '6px 0' }}>
              {myResult.payoff >= 0 ? '+' : ''}
              {myResult.payoff.toLocaleString()} 원
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              나의 선택: <b>{(pdState.strategies || { D: '부인', R: '고발' })[myResult.myChoice]}</b>
              {' / '}
              상대 선택: <b>{(pdState.strategies || { D: '부인', R: '고발' })[myResult.opponentChoice]}</b>
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 16 }} />
      <Link href={`/student/${id}/change-pin`} className="muted" style={{ fontSize: 13, textDecoration: 'underline' }}>
        PIN 변경
      </Link>
    </div>
  );
}

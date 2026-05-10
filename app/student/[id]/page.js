'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function StudentDashboard({ params }) {
  const { id } = params;
  const [me, setMe] = useState(null);
  const [pdState, setPdState] = useState(null);
  const [bidState, setBidState] = useState(null);

  async function refresh() {
    const r1 = await fetch(`/api/student/${id}`);
    const d1 = await r1.json();
    if (d1.ok) setMe(d1.student);

    const r2 = await fetch('/api/pd/state');
    const d2 = await r2.json();
    if (d2.ok) setPdState(d2.state);

    const r3 = await fetch(`/api/bid/state?studentId=${id}`);
    const d3 = await r3.json();
    if (d3.ok) setBidState(d3.state);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  if (!me) {
    return (
      <div className="container">
        <div className="muted">로딩 중…</div>
      </div>
    );
  }

  // ----- 게임 2: 죄수의 딜레마 -----
  const myPair = pdState?.pairs?.find((p) => p.includes(id));
  const isInPd = pdState?.status === 'active' && !!myPair;
  const myPdResult = pdState?.status === 'completed' && pdState?.results?.[id];
  const pdStatus = pdState?.status || 'idle';

  // ----- 게임 1: 최저가 입찰 게임 -----
  const bidStatus = bidState?.status || 'idle';
  const myBid = bidState?.myBid;
  const bidResults = bidState?.results;
  const alreadyBid =
    myBid !== undefined && myBid !== null;

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
        <div className="balance-amount">
          {(me.balance || 0).toLocaleString()}
        </div>
        <div className="balance-unit">원</div>
      </div>

      <div style={{ height: 28 }} />
      <div className="section-title">게임</div>
      <div style={{ height: 8 }} />

      {/* ============ 게임 1: 최저가 입찰 게임 ============ */}
      <div className="card">
        <div className="row-between">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              게임 1 · 최저가 입찰 게임
            </div>
            <div className="muted" style={{ marginTop: 2 }}>
              가장 작은 숫자를 쓴 사람이 우승합니다
            </div>
          </div>
          <span className={`status-badge status-${bidStatus}`}>
            {bidStatus === 'active'
              ? '진행 중'
              : bidStatus === 'completed'
              ? '완료'
              : '대기'}
          </span>
        </div>

        <div style={{ height: 14 }} />

        {bidStatus === 'idle' && (
          <div className="muted">
            교수님이 게임을 시작하면 이 자리에 입장 버튼이 나타납니다.
          </div>
        )}

        {bidStatus === 'active' && !alreadyBid && (
          <Link
            href={`/student/${id}/bid`}
            className="btn btn-block btn-accent"
          >
            게임 입장
          </Link>
        )}

        {bidStatus === 'active' && alreadyBid && (
          <div>
            <div className="success">✓ 제출 완료</div>
            <div style={{ height: 10 }} />
            <div className="muted" style={{ fontSize: 13 }}>
              내가 낸 숫자
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
              {Number(myBid).toLocaleString()}원
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              교수님의 결과 확정을 기다리는 중…
            </div>
          </div>
        )}

        {bidStatus === 'completed' && bidResults && (
          <div>
            <div className="muted" style={{ fontSize: 13 }}>
              내가 낸 숫자
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
              {alreadyBid
                ? `${Number(myBid).toLocaleString()}원`
                : '미제출'}
            </div>

            <div style={{ height: 10 }} />
            <div className="muted" style={{ fontSize: 13 }}>
              최저 숫자
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
              {Number(bidResults.lowestBid).toLocaleString()}원
            </div>

            <div style={{ height: 10 }} />
            <div className="muted" style={{ fontSize: 13 }}>
              내 상금
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: bidResults.isWinner ? 'var(--gold)' : 'var(--ink)',
                marginTop: 2,
              }}
            >
              {bidResults.isWinner ? '+' : ''}
              {Number(bidResults.myPayoff || 0).toLocaleString()}원
            </div>

            <div style={{ height: 10 }} />
            {bidResults.winnerNames ? (
              <div className="muted" style={{ fontSize: 13 }}>
                우승자: <b>{bidResults.winnerNames.join(', ')}</b>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>
                우승자: <b>익명 {bidResults.winnerCount}명</b>
              </div>
            )}
          </div>
        )}

        {bidStatus === 'completed' && !bidResults && (
          <div className="muted">결과 대기 중…</div>
        )}
      </div>

      <div style={{ height: 16 }} />

      {/* ============ 게임 2: 죄수의 딜레마 ============ */}
      <div className="card">
        <div className="row-between">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              게임 2 · 죄수의 딜레마
            </div>
            <div className="muted" style={{ marginTop: 2 }}>
              2인 동시 선택 게임
            </div>
          </div>
          <span className={`status-badge status-${pdStatus}`}>
            {pdStatus === 'active'
              ? '진행 중'
              : pdStatus === 'completed'
              ? '완료'
              : '대기'}
          </span>
        </div>

        <div style={{ height: 14 }} />

        {!isInPd && !myPdResult && (
          <div className="muted">
            교수님이 게임을 시작하면 이 자리에 입장 버튼이 나타납니다.
          </div>
        )}

        {isInPd && pdState.choices?.[id] && (
          <div className="success">
            ✓ 선택을 제출했습니다. 상대방과 교수님의 확정을 기다리는 중…
          </div>
        )}

        {isInPd && !pdState.choices?.[id] && (
          <Link
            href={`/student/${id}/pd`}
            className="btn btn-block btn-accent"
          >
            게임 입장
          </Link>
        )}

        {myPdResult && (
          <div>
            <div className="muted">이번 라운드 결과</div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: 'var(--gold)',
                margin: '6px 0',
              }}
            >
              {myPdResult.payoff >= 0 ? '+' : ''}
              {myPdResult.payoff.toLocaleString()} 원
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              나의 선택:{' '}
              <b>
                {(pdState.strategies || { D: '부인', R: '고발' })[
                  myPdResult.myChoice
                ]}
              </b>
              {' / '}
              상대 선택:{' '}
              <b>
                {(pdState.strategies || { D: '부인', R: '고발' })[
                  myPdResult.opponentChoice
                ]}
              </b>
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 16 }} />
      <Link
        href={`/student/${id}/change-pin`}
        className="muted"
        style={{ fontSize: 13, textDecoration: 'underline' }}
      >
        PIN 변경
      </Link>
    </div>
  );
}

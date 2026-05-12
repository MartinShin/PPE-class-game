'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function StudentDashboard({ params }) {
  const { id } = params;
  const [me, setMe] = useState(null);
  const [pdState, setPdState] = useState(null);
  const [bidState, setBidState] = useState(null);
  const [pgState, setPgState] = useState(null);

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

    const r4 = await fetch('/api/pg/state');
    const d4 = await r4.json();
    if (d4.ok) setPgState(d4.state);
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

  // ----- 게임 3: 공공재 게임 -----
  const pgStatus = pgState?.status || 'idle';
  const pgInGroup = !!pgState?.groups?.some((g) => g.includes(id));
  const pgMyContribution = pgState?.contributions?.[id];
  const pgSubmittedContrib = pgMyContribution !== undefined;
  const pgSubmittedPunish = pgState?.punishments?.[id] !== undefined;
  const pgMyResult = pgState?.results?.[id];
  const pgStratC = pgState?.settings?.strategies?.C || '기여하기';
  const pgStratN = pgState?.settings?.strategies?.N || '기여하지 않기';
  // 학생이 입장해야 하는 상태인가
  const pgNeedsAction =
    pgInGroup &&
    ((pgStatus === 'active' && !pgSubmittedContrib) ||
      (pgStatus === 'punishing' && !pgSubmittedPunish));

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

      {/* ============ 게임 3: 공공재 게임 ============ */}
      <div className="card">
        <div className="row-between">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              게임 3 · 공공재 게임
            </div>
            <div className="muted" style={{ marginTop: 2 }}>
              그룹 단위 협력 게임
            </div>
          </div>
          <span className={`status-badge status-${
            pgStatus === 'punishing' ? 'active' :
            pgStatus === 'finished' ? 'completed' : pgStatus
          }`}>
            {pgStatus === 'active'
              ? `라운드 ${pgState?.currentRound || 1} 진행 중`
              : pgStatus === 'punishing'
              ? `라운드 ${pgState?.currentRound || 1} 처벌 단계`
              : pgStatus === 'completed'
              ? `라운드 ${pgState?.currentRound || 1} 결과`
              : pgStatus === 'finished'
              ? '종료'
              : '대기'}
          </span>
        </div>

        <div style={{ height: 14 }} />

        {pgStatus === 'idle' && (
          <div className="muted">
            교수님이 게임을 시작하면 이 자리에 입장 버튼이 나타납니다.
          </div>
        )}

        {pgStatus === 'finished' && (
          <div className="muted">
            게임이 종료되었습니다. 결과는 누적 상금에 반영되어 있습니다.
          </div>
        )}

        {(pgStatus === 'active' || pgStatus === 'punishing') && !pgInGroup && (
          <div className="muted">
            이번 게임에서는 그룹이 배정되지 않았습니다.
          </div>
        )}

        {pgNeedsAction && (
          <Link
            href={`/student/${id}/pg`}
            className="btn btn-block btn-accent"
          >
            게임 입장
          </Link>
        )}

        {pgInGroup && pgStatus === 'active' && pgSubmittedContrib && (
          <div>
            <div className="success">✓ 기여 제출 완료</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              내가 낸 기여:{' '}
              <b>
                {pgState.settings.mode === 'discrete'
                  ? pgMyContribution === 'C'
                    ? pgStratC
                    : pgStratN
                  : `${Number(pgMyContribution).toLocaleString()}원`}
              </b>
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              그룹원 전원의 제출과 교수님의 확정을 기다리는 중…
            </div>
          </div>
        )}

        {pgInGroup && pgStatus === 'punishing' && pgSubmittedPunish && (
          <div>
            <div className="success">✓ 처벌 제출 완료</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              교수님의 결과 확정을 기다리는 중…
            </div>
          </div>
        )}

        {pgStatus === 'completed' && pgMyResult && (
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
              {pgMyResult.roundPayoff >= 0 ? '+' : ''}
              {pgMyResult.roundPayoff.toLocaleString()} 원
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              그룹 내 기여자: <b>{pgMyResult.contributorsCount}/{pgMyResult.groupSize}</b>
            </div>
            <div style={{ height: 8 }} />
            <Link
              href={`/student/${id}/pg`}
              className="btn btn-block btn-secondary"
              style={{ fontSize: 13, padding: 8 }}
            >
              상세 결과 보기
            </Link>
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

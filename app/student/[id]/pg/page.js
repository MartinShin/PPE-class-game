'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PublicGoodGame({ params }) {
  const { id } = params;
  const [pgState, setPgState] = useState(null);
  const [me, setMe] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]); // [{ id, name }]
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 연속형 입력값 (로컬 상태)
  const [contribAmount, setContribAmount] = useState(0);

  // 처벌 입력값 (로컬 상태) { targetId: points }
  const [punishInputs, setPunishInputs] = useState({});

  async function refresh() {
    const [r1, r2] = await Promise.all([
      fetch('/api/pg/state').then((r) => r.json()),
      fetch(`/api/student/${id}`).then((r) => r.json()),
    ]);
    if (r1.ok) setPgState(r1.state);
    if (r2.ok) setMe(r2.student);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  // 내 그룹 멤버 이름 가져오기
  useEffect(() => {
    if (!pgState) return;
    const myGroup = pgState.groups?.find((g) => g.includes(id));
    if (!myGroup) {
      setGroupMembers([]);
      return;
    }
    Promise.all(
      myGroup.map((mid) =>
        fetch(`/api/student/${mid}`).then((r) => r.json())
      )
    ).then((arr) => {
      const list = arr
        .filter((d) => d.ok)
        .map((d) => ({ id: d.student.id, name: d.student.name }));
      setGroupMembers(list);
    });
  }, [pgState, id]);

  if (!pgState || !me) {
    return (
      <div className="container">
        <div className="muted">로딩 중…</div>
      </div>
    );
  }

  const settings = pgState.settings;
  const myGroup = pgState.groups?.find((g) => g.includes(id));
  const status = pgState.status;
  const stratC = settings.strategies?.C || '기여하기';
  const stratN = settings.strategies?.N || '기여하지 않기';

  // ---------- 대기 / 종료 화면 ----------
  if (status === 'idle' || !myGroup) {
    return (
      <div className="container">
        <div className="header">
          <div className="title-kor">공공재 게임</div>
          <div className="subtitle">
            {me.name} · 누적 {(me.balance || 0).toLocaleString()}원
          </div>
        </div>
        <div className="card">
          <div className="muted">
            {status === 'idle'
              ? '교수님이 게임을 시작하기를 기다리는 중입니다.'
              : '그룹이 배정되지 않았습니다.'}
          </div>
          <div style={{ height: 12 }} />
          <Link
            href={`/student/${id}`}
            className="btn btn-block btn-secondary"
          >
            대시보드로
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'finished') {
    return (
      <div className="container">
        <div className="header">
          <div className="title-kor">공공재 게임</div>
          <div className="subtitle">
            {me.name} · 누적 {(me.balance || 0).toLocaleString()}원
          </div>
        </div>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>게임 종료</div>
          <div className="muted">
            {settings.numRounds}라운드 모두 끝났습니다.
          </div>
          <div style={{ height: 12 }} />
          <Link
            href={`/student/${id}`}
            className="btn btn-block btn-accent"
          >
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const myContribution = pgState.contributions?.[id];
  const submittedContrib = myContribution !== undefined;
  const myPunishments = pgState.punishments?.[id];
  const submittedPunish = myPunishments !== undefined;

  // ---------- active: 기여 입력 ----------
  if (status === 'active') {
    return (
      <ContributionStage
        me={me}
        myGroup={myGroup}
        groupMembers={groupMembers}
        pgState={pgState}
        submittedContrib={submittedContrib}
        myContribution={myContribution}
        contribAmount={contribAmount}
        setContribAmount={setContribAmount}
        onSubmit={async (value) => {
          if (submittedContrib || submitting) return;
          setSubmitting(true);
          setError('');
          const res = await fetch('/api/pg/choice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: id, contribution: value }),
          });
          const data = await res.json();
          setSubmitting(false);
          if (!data.ok) setError(data.error || '제출 실패');
          else refresh();
        }}
        submitting={submitting}
        error={error}
        stratC={stratC}
        stratN={stratN}
        studentId={id}
      />
    );
  }

  // ---------- punishing: 처벌 입력 ----------
  if (status === 'punishing') {
    return (
      <PunishmentStage
        me={me}
        myGroup={myGroup}
        groupMembers={groupMembers}
        pgState={pgState}
        submittedPunish={submittedPunish}
        myPunishments={myPunishments}
        punishInputs={punishInputs}
        setPunishInputs={setPunishInputs}
        onSubmit={async (targets) => {
          if (submittedPunish || submitting) return;
          setSubmitting(true);
          setError('');
          const res = await fetch('/api/pg/punish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: id, targets }),
          });
          const data = await res.json();
          setSubmitting(false);
          if (!data.ok) setError(data.error || '제출 실패');
          else refresh();
        }}
        submitting={submitting}
        error={error}
        stratC={stratC}
        stratN={stratN}
        studentId={id}
      />
    );
  }

  // ---------- completed: 결과 화면 ----------
  if (status === 'completed') {
    const myResult = pgState.results?.[id];
    return (
      <div className="container">
        <div className="header">
          <div className="title-kor">공공재 게임</div>
          <div className="subtitle">
            라운드 {pgState.currentRound} / {settings.numRounds} 결과
          </div>
        </div>

        <div className="balance-display">
          <div className="balance-label">누적 상금</div>
          <div className="balance-amount">
            {(me.balance || 0).toLocaleString()}
          </div>
          <div className="balance-unit">원</div>
        </div>

        <div style={{ height: 16 }} />

        {myResult ? (
          <div className="card">
            <div className="section-title">이번 라운드</div>
            <table className="balance-list">
              <tbody>
                <tr>
                  <td>그룹 크기</td>
                  <td className="amount-col">{myResult.groupSize}명</td>
                </tr>
                <tr>
                  <td>그룹 내 기여자 수</td>
                  <td className="amount-col">
                    {myResult.contributorsCount} / {myResult.groupSize}
                  </td>
                </tr>
                <tr>
                  <td>나의 기여</td>
                  <td className="amount-col">
                    {settings.mode === 'discrete'
                      ? myResult.contribution.contributed
                        ? `${stratC}`
                        : `${stratN}`
                      : `${(myResult.contribution.amount || 0).toLocaleString()}원`}
                  </td>
                </tr>
                <tr>
                  <td>라운드 기본 보수</td>
                  <td className="amount-col">
                    {myResult.basePayoff.toLocaleString()}원
                  </td>
                </tr>
                {settings.punishmentEnabled && (
                  <>
                    <tr>
                      <td>받은 처벌 (포인트)</td>
                      <td className="amount-col">
                        {myResult.punishReceived}
                        {myResult.punishReceived > 0 &&
                          ` (−${myResult.punishLoss.toLocaleString()}원)`}
                      </td>
                    </tr>
                    <tr>
                      <td>가한 처벌 (포인트)</td>
                      <td className="amount-col">
                        {myResult.punishGiven}
                        {myResult.punishGiven > 0 &&
                          ` (−${myResult.punishCostTotal.toLocaleString()}원)`}
                      </td>
                    </tr>
                  </>
                )}
                <tr style={{ background: '#faf3e0' }}>
                  <td>
                    <b>최종 라운드 보수</b>
                  </td>
                  <td className="amount-col">
                    <b style={{ color: 'var(--gold)' }}>
                      {myResult.roundPayoff >= 0 ? '+' : ''}
                      {myResult.roundPayoff.toLocaleString()}원
                    </b>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              ※ 그룹 내 개별 학생의 이름·기여는 비공개입니다.
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="muted">결과 처리 중…</div>
          </div>
        )}

        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>
            {pgState.currentRound < settings.numRounds
              ? `다음 라운드 (${pgState.currentRound + 1}/${settings.numRounds}) 시작을 기다리는 중…`
              : '모든 라운드가 끝났습니다. 교수님이 게임을 마무리합니다.'}
          </div>
        </div>

        <Link
          href={`/student/${id}`}
          className="btn btn-block btn-secondary"
        >
          대시보드로
        </Link>
      </div>
    );
  }

  return null;
}

// ============================================================
// 기여 입력 단계
// ============================================================
function ContributionStage({
  me,
  myGroup,
  groupMembers,
  pgState,
  submittedContrib,
  myContribution,
  contribAmount,
  setContribAmount,
  onSubmit,
  submitting,
  error,
  stratC,
  stratN,
  studentId,
}) {
  const settings = pgState.settings;
  const N = myGroup.length;
  const isDiscrete = settings.mode === 'discrete';

  return (
    <div className="container">
      <div className="header">
        <div className="title-kor">공공재 게임</div>
        <div className="subtitle">
          라운드 {pgState.currentRound} / {settings.numRounds} · {me.name} · 누적{' '}
          {(me.balance || 0).toLocaleString()}원
        </div>
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 6 }}>
          <div className="muted">내 그룹</div>
          <span className="role-badge">{N}명</span>
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          {groupMembers.map((m) => m.name).join(' · ') || '...'}
        </div>
      </div>

      {isDiscrete ? (
        <DiscretePayoffTable settings={settings} N={N} />
      ) : (
        <ContinuousIntro settings={settings} N={N} />
      )}

      {isDiscrete ? (
        <DiscreteChoice
          submitted={submittedContrib}
          myContribution={myContribution}
          submitting={submitting}
          onSubmit={onSubmit}
          stratC={stratC}
          stratN={stratN}
        />
      ) : (
        <ContinuousInput
          settings={settings}
          submitted={submittedContrib}
          myContribution={myContribution}
          contribAmount={contribAmount}
          setContribAmount={setContribAmount}
          submitting={submitting}
          onSubmit={onSubmit}
        />
      )}

      {error && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="error">{error}</div>
        </div>
      )}

      <Link
        href={`/student/${studentId}`}
        className="btn btn-block btn-secondary"
      >
        대시보드로
      </Link>
    </div>
  );
}

// 이산형 보수표: 다른 기여자 수(0..N-1)별 본인 보수
function DiscretePayoffTable({ settings, N }) {
  const B = settings.benefit;
  const C = settings.cost;
  // 행: 다른 기여자 수 k' (0..N-1)
  // 기여 시 본인 보수 = (k'+1)*B - C
  // 비기여 시 본인 보수 = k'*B
  const rows = [];
  for (let kp = 0; kp < N; kp++) {
    rows.push({
      others: kp,
      ifContrib: (kp + 1) * B - C,
      ifNot: kp * B,
    });
  }
  return (
    <div className="card">
      <div className="section-title">보수표</div>
      <div className="muted" style={{ fontSize: 12, margin: '6px 0 10px' }}>
        그룹 {N}명. 기여 비용 {C.toLocaleString()}원,
        기여 1건당 그룹원 모두에게 {B.toLocaleString()}원의 편익이 생깁니다.
      </div>
      <table className="balance-list">
        <thead>
          <tr>
            <th>다른 기여자 수</th>
            <th className="amount-col">기여 시 내 보수</th>
            <th className="amount-col">비기여 시 내 보수</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.others}>
              <td>{r.others}명</td>
              <td className="amount-col" style={{ color: 'var(--green)' }}>
                {r.ifContrib.toLocaleString()}원
              </td>
              <td className="amount-col" style={{ color: 'var(--accent)' }}>
                {r.ifNot.toLocaleString()}원
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        ※ 본인의 기여 여부와 무관하게, 그룹의 모든 기여로부터 편익을 받습니다.
      </div>
    </div>
  );
}

function DiscreteChoice({
  submitted,
  myContribution,
  submitting,
  onSubmit,
  stratC,
  stratN,
}) {
  return (
    <div className="card">
      <div className="section-title">선택</div>
      <div className="muted" style={{ marginTop: 8 }}>
        {submitted
          ? '제출 완료. 변경할 수 없습니다.'
          : '한 번 누르면 변경할 수 없습니다.'}
      </div>
      <div className="choice-buttons">
        <button
          className={`choice-btn ${myContribution === 'C' ? 'active-deny' : ''}`}
          onClick={() => onSubmit('C')}
          disabled={submitted || submitting}
        >
          {stratC}
        </button>
        <button
          className={`choice-btn ${myContribution === 'N' ? 'active-report' : ''}`}
          onClick={() => onSubmit('N')}
          disabled={submitted || submitting}
        >
          {stratN}
        </button>
      </div>
      {submitted && (
        <div className="success" style={{ marginTop: 10 }}>
          ✓ 제출: {myContribution === 'C' ? stratC : stratN}
        </div>
      )}
    </div>
  );
}

function ContinuousIntro({ settings, N }) {
  return (
    <div className="card">
      <div className="section-title">규칙</div>
      <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
        매 라운드 <b>{settings.endowment.toLocaleString()}원</b>을 받습니다.
        이 중 일부 또는 전부를 그룹 공동기금에 기여할 수 있습니다.
        <br />
        공동기금에 들어간 1원당 그룹 {N}명 <b>모두</b>에게{' '}
        <b>{settings.mpcr}원</b>이 분배됩니다 (본인 포함).
        <br />
        본인 라운드 보수 = ({settings.endowment.toLocaleString()}원 − 내 기여)
        + {settings.mpcr} × (그룹 총 기여)
      </div>
    </div>
  );
}

function ContinuousInput({
  settings,
  submitted,
  myContribution,
  contribAmount,
  setContribAmount,
  submitting,
  onSubmit,
}) {
  const max = settings.endowment;
  const step = settings.increment;
  const value = submitted ? myContribution : contribAmount;
  return (
    <div className="card">
      <div className="section-title">기여 금액</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        0원에서 {max.toLocaleString()}원 사이 ({step.toLocaleString()}원 단위)
      </div>
      <div style={{ height: 14 }} />

      <div
        style={{
          textAlign: 'center',
          fontSize: 32,
          fontWeight: 700,
          color: 'var(--gold)',
        }}
      >
        {Number(value || 0).toLocaleString()}원
      </div>
      <div className="muted" style={{ textAlign: 'center', fontSize: 12 }}>
        (남는 자금: {(max - Number(value || 0)).toLocaleString()}원)
      </div>

      <div style={{ height: 14 }} />
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={Number(value || 0)}
        onChange={(e) => setContribAmount(Number(e.target.value))}
        disabled={submitted || submitting}
        style={{ width: '100%' }}
      />
      <div className="row-between" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
        <span>0원</span>
        <span>{max.toLocaleString()}원</span>
      </div>

      <div style={{ height: 12 }} />
      <input
        className="input"
        type="text"
        inputMode="numeric"
        value={Number(value || 0).toLocaleString('ko-KR')}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d]/g, '');
          const n = v === '' ? 0 : Math.min(Number(v), max);
          setContribAmount(n);
        }}
        disabled={submitted || submitting}
        style={{ textAlign: 'right' }}
      />

      <div style={{ height: 14 }} />
      <button
        className="btn btn-block btn-accent"
        onClick={() => onSubmit(contribAmount)}
        disabled={submitted || submitting}
      >
        {submitted ? '✓ 제출됨' : `${Number(contribAmount).toLocaleString()}원 기여로 제출`}
      </button>
      {submitted && (
        <div className="success" style={{ marginTop: 10 }}>
          ✓ 제출 완료: {Number(myContribution).toLocaleString()}원
        </div>
      )}
    </div>
  );
}

// ============================================================
// 처벌 입력 단계
// ============================================================
function PunishmentStage({
  me,
  myGroup,
  groupMembers,
  pgState,
  submittedPunish,
  myPunishments,
  punishInputs,
  setPunishInputs,
  onSubmit,
  submitting,
  error,
  stratC,
  stratN,
  studentId,
}) {
  const settings = pgState.settings;
  const max = settings.punishmentMax;
  const contributions = pgState.contributions || {};
  const isDiscrete = settings.mode === 'discrete';
  const others = groupMembers.filter((m) => m.id !== studentId);

  function setPoints(targetId, v) {
    let n = Number(v);
    if (!Number.isFinite(n) || n < 0) n = 0;
    n = Math.min(Math.floor(n), max);
    setPunishInputs({ ...punishInputs, [targetId]: n });
  }

  function inc(targetId, delta) {
    const cur = Number(punishInputs[targetId] || 0);
    const next = Math.max(0, Math.min(max, cur + delta));
    setPunishInputs({ ...punishInputs, [targetId]: next });
  }

  const totalGiven = Object.values(punishInputs).reduce(
    (s, v) => s + (Number(v) || 0),
    0
  );
  const totalCost = totalGiven * settings.punishmentCost;

  return (
    <div className="container">
      <div className="header">
        <div className="title-kor">공공재 게임 — 처벌 단계</div>
        <div className="subtitle">
          라운드 {pgState.currentRound} / {settings.numRounds} · {me.name}
        </div>
      </div>

      <div className="card">
        <div className="section-title">그룹원 기여 공개</div>
        <table className="balance-list">
          <thead>
            <tr>
              <th>그룹원</th>
              <th className="amount-col">기여</th>
            </tr>
          </thead>
          <tbody>
            {groupMembers.map((m) => {
              const c = contributions[m.id];
              const isMe = m.id === studentId;
              const label = isDiscrete
                ? c === 'C'
                  ? stratC
                  : c === 'N'
                  ? stratN
                  : '미제출'
                : typeof c === 'number'
                ? `${c.toLocaleString()}원`
                : '미제출';
              return (
                <tr key={m.id} style={isMe ? { background: '#faf3e0' } : undefined}>
                  <td>
                    {m.name}
                    {isMe && (
                      <span className="muted" style={{ fontSize: 11 }}>
                        {' '}
                        (나)
                      </span>
                    )}
                  </td>
                  <td className="amount-col">{label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="section-title">처벌 할당</div>
        <div className="muted" style={{ fontSize: 12, margin: '6px 0 12px' }}>
          그룹원에게 처벌 포인트를 줄 수 있습니다. <br />
          1포인트당 본인 부담{' '}
          <b>{settings.punishmentCost.toLocaleString()}원</b>, 대상자
          차감 <b>{settings.punishmentEffect.toLocaleString()}원</b>. 1명당 최대{' '}
          <b>{max}</b>포인트.
        </div>

        {submittedPunish ? (
          <div className="success">✓ 처벌 제출 완료</div>
        ) : (
          <>
            {others.map((m) => {
              const v = Number(punishInputs[m.id] || 0);
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto',
                    gap: 8,
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <button
                    onClick={() => inc(m.id, -1)}
                    disabled={submitting}
                    style={btnPunish}
                  >
                    −
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={v}
                    onChange={(e) => setPoints(m.id, e.target.value)}
                    disabled={submitting}
                    style={{
                      width: 50,
                      textAlign: 'center',
                      padding: 6,
                      border: '1px solid var(--line)',
                      borderRadius: 4,
                      fontSize: 16,
                      fontWeight: 700,
                    }}
                  />
                  <button
                    onClick={() => inc(m.id, +1)}
                    disabled={submitting}
                    style={btnPunish}
                  >
                    +
                  </button>
                </div>
              );
            })}
            <div style={{ height: 12 }} />
            <div className="muted" style={{ fontSize: 13 }}>
              총 처벌: <b>{totalGiven}포인트</b> · 본인 부담:{' '}
              <b style={{ color: 'var(--accent)' }}>
                {totalCost.toLocaleString()}원
              </b>
            </div>
            <div style={{ height: 12 }} />
            <button
              className="btn btn-block btn-accent"
              onClick={() => onSubmit(punishInputs)}
              disabled={submitting}
            >
              제출 (변경 불가)
            </button>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              ※ 처벌하지 않으려면 모두 0으로 두고 제출하세요.
            </div>
          </>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <Link
        href={`/student/${studentId}`}
        className="btn btn-block btn-secondary"
      >
        대시보드로
      </Link>
    </div>
  );
}

const btnPunish = {
  width: 36,
  height: 36,
  borderRadius: 4,
  border: '1px solid var(--line)',
  background: '#fff',
  fontSize: 18,
  fontWeight: 700,
};

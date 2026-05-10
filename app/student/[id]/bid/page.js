'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function BidPage({ params }) {
  const { id } = params;
  const [me, setMe] = useState(null);
  const [bidState, setBidState] = useState(null);
  const [bid, setBid] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    const r1 = await fetch(`/api/student/${id}`);
    const d1 = await r1.json();
    if (d1.ok) setMe(d1.student);
    const r2 = await fetch(`/api/bid/state?studentId=${id}`);
    const d2 = await r2.json();
    if (d2.ok) setBidState(d2.state);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  async function submit() {
    setError('');
    if (bid === '' || bid === null || bid === undefined) {
      setError('숫자를 입력하세요');
      return;
    }
    const n = parseInt(bid, 10);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      setError('0을 포함한 자연수만 입력 가능합니다');
      return;
    }
    const min = bidState?.settings?.min ?? 0;
    const max = bidState?.settings?.max ?? 10000;
    if (n < min || n > max) {
      setError(
        `${min.toLocaleString()}원 이상 ${max.toLocaleString()}원 이하의 숫자만 입력 가능합니다`
      );
      return;
    }
    if (!confirm(`${n.toLocaleString()}원을 제출합니다. 한 번 제출하면 수정할 수 없습니다. 진행할까요?`)) {
      return;
    }
    setSubmitting(true);
    const res = await fetch('/api/bid/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: id, bid: n }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!data.ok) {
      setError(data.error || '제출 실패');
      return;
    }
    refresh();
  }

  if (!me || !bidState) {
    return (
      <div className="container">
        <div className="muted">로딩 중…</div>
      </div>
    );
  }

  const min = bidState.settings?.min ?? 0;
  const max = bidState.settings?.max ?? 10000;
  const alreadyBid = bidState.myBid !== undefined && bidState.myBid !== null;

  return (
    <div className="container">
      <div className="header row-between">
        <div>
          <div className="title-kor">최저가 입찰 게임</div>
          <div className="subtitle">{me.name}</div>
        </div>
        <Link
          href={`/student/${id}`}
          className="muted"
          style={{ textDecoration: 'underline' }}
        >
          ← 대시보드
        </Link>
      </div>

      {bidState.status === 'idle' && (
        <div className="card">
          <div className="muted">
            교수님이 아직 게임을 시작하지 않았습니다.
          </div>
        </div>
      )}

      {bidState.status === 'active' && alreadyBid && (
        <div className="card">
          <div className="success">✓ 제출 완료</div>
          <div style={{ height: 12 }} />
          <div className="muted" style={{ fontSize: 13 }}>
            내가 낸 숫자
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: 'var(--gold)',
              marginTop: 4,
            }}
          >
            {Number(bidState.myBid).toLocaleString()}원
          </div>
          <div style={{ height: 10 }} />
          <div className="muted" style={{ fontSize: 13 }}>
            교수님의 결과 확정을 기다리는 중…
          </div>
        </div>
      )}

      {bidState.status === 'active' && !alreadyBid && (
        <div className="card">
          <div style={{ fontSize: 15, lineHeight: 1.6 }}>
            <b>
              {min.toLocaleString()}원 이상 {max.toLocaleString()}원 이하
            </b>
            의 자연수(0 포함)를 입력하세요.
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            ※ 가장 작은 숫자를 쓴 사람이 우승합니다.<br />
            ※ 한 번 제출하면 수정할 수 없습니다.<br />
            ※ 다른 학생들이 어떤 숫자를 쓰는지는 알 수 없습니다.
          </div>
          <div style={{ height: 16 }} />
          <label className="label">내 입찰 숫자</label>
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              value={bid}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, '');
                setBid(v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder="예: 1000"
              style={{
                paddingRight: 40,
                textAlign: 'right',
                fontSize: 20,
                fontWeight: 600,
              }}
              disabled={submitting}
              autoFocus
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
          {error && (
            <div className="error" style={{ marginTop: 8 }}>
              {error}
            </div>
          )}
          <div style={{ height: 16 }} />
          <button
            className="btn btn-block btn-accent"
            onClick={submit}
            disabled={submitting || bid === ''}
          >
            {submitting ? '제출 중…' : '제출하기'}
          </button>
        </div>
      )}

      {bidState.status === 'completed' && (
        <div className="card">
          <div className="muted">
            이번 라운드는 종료되었습니다. 대시보드에서 결과를 확인하세요.
          </div>
          <div style={{ height: 12 }} />
          <Link
            href={`/student/${id}`}
            className="btn btn-block btn-accent"
          >
            대시보드로 돌아가기
          </Link>
        </div>
      )}
    </div>
  );
}

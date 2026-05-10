'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ChangePinInner({ id }) {
  const sp = useSearchParams();
  const isFirstLogin = sp.get('first') === '1';
  const router = useRouter();

  const [currentPin, setCurrentPin] = useState(isFirstLogin ? '1111' : '');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setError('');
    if (!/^\d{4}$/.test(newPin)) {
      setError('새 PIN은 4자리 숫자여야 합니다');
      return;
    }
    if (newPin !== confirmPin) {
      setError('새 PIN 확인이 일치하지 않습니다');
      return;
    }
    if (newPin === '1111') {
      setError('기본 PIN(1111)은 사용할 수 없습니다. 다른 번호로 정해주세요');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/student/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, currentPin, newPin }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) {
      setDone(true);
      setTimeout(() => router.push(`/student/${id}`), 1500);
    } else {
      setError(data.error || '변경 실패');
    }
  }

  if (done) {
    return (
      <div className="container">
        <div className="card" style={{ background: '#e7f0e8' }}>
          <div style={{ color: 'var(--green)', fontWeight: 700, fontSize: 18 }}>
            ✓ PIN이 변경되었습니다
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            대시보드로 이동합니다…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <div className="title-kor">{isFirstLogin ? '첫 로그인 — PIN 설정' : 'PIN 변경'}</div>
        <div className="subtitle">
          {isFirstLogin
            ? '본인만 아는 4자리 PIN을 새로 정해주세요'
            : '새로운 PIN으로 변경합니다'}
        </div>
      </div>

      <div className="card">
        {!isFirstLogin && (
          <>
            <label className="label">현재 PIN</label>
            <input
              className="input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
            />
            <div style={{ height: 14 }} />
          </>
        )}

        <label className="label">새 PIN (4자리 숫자)</label>
        <input
          className="input"
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
          autoFocus={isFirstLogin}
        />
        <div style={{ height: 14 }} />

        <label className="label">새 PIN 확인</label>
        <input
          className="input"
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        {error && <div className="error">{error}</div>}

        <div style={{ height: 16 }} />
        <button
          className="btn btn-block btn-accent"
          onClick={submit}
          disabled={loading || !newPin || !confirmPin}
        >
          {loading ? '변경 중…' : 'PIN 변경'}
        </button>

        {!isFirstLogin && (
          <>
            <div style={{ height: 8 }} />
            <Link href={`/student/${id}`} className="btn btn-block btn-secondary">
              취소
            </Link>
          </>
        )}
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        PIN을 잊어버렸다면 교수님께 알려주세요. 1111로 초기화해드립니다.
      </div>
    </div>
  );
}

export default function ChangePinPage({ params }) {
  return (
    <Suspense fallback={<div className="container"><div className="muted">로딩…</div></div>}>
      <ChangePinInner id={params.id} />
    </Suspense>
  );
}

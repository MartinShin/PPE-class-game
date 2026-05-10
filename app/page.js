'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function HomeInner() {
  const sp = useSearchParams();
  const showTest = sp.get('test') === '1';
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/students${showTest ? '?test=1' : ''}`)
      .then((r) => r.json())
      .then((d) => setStudents(d.students || []));
  }, [showTest]);

  async function submit() {
    if (!selected || !pin) return;
    setLoading(true);
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, pin }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) {
      // 기본 PIN(1111)이면 변경 페이지로 강제 유도
      if (data.student.isDefaultPin) {
        router.push(`/student/${selected.id}/change-pin?first=1`);
      } else {
        router.push(`/student/${selected.id}`);
      }
    } else {
      setError(data.error || 'PIN이 올바르지 않습니다');
      setPin('');
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div className="title-kor">정치경제철학 개론</div>
        <div className="subtitle">
          2026 봄학기 · 신호철 · 수업 게임
          {showTest && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>· 테스트 모드</span>}
        </div>
      </div>

      {!selected && (
        <>
          <div className="section-title">이름을 선택하세요</div>
          <div style={{ height: 8 }} />
          <div className="student-grid">
            {students.map((s) => (
              <button
                key={s.id}
                className="student-tile"
                onClick={() => setSelected(s)}
                style={s.isTest ? { borderStyle: 'dashed', background: '#faf3e0' } : undefined}
              >
                {s.name}
                {s.isTest && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>(test)</div>}
              </button>
            ))}
          </div>
          {students.length === 0 && (
            <div className="muted">학생 목록을 불러오는 중…</div>
          )}
        </>
      )}

      {selected && (
        <div className="card">
          <div className="muted">선택한 학생</div>
          <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 18px' }}>
            {selected.name}
          </div>
          <label className="label">PIN 4자리</label>
          <input
            className="input"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoFocus
          />
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            ※ 처음 로그인하는 학생은 <b>1111</b>
          </div>
          {error && <div className="error">{error}</div>}
          <div style={{ height: 14 }} />
          <button
            className="btn btn-block btn-accent"
            onClick={submit}
            disabled={loading || pin.length < 4}
          >
            {loading ? '확인 중…' : '로그인'}
          </button>
          <div style={{ height: 8 }} />
          <button
            className="btn btn-block btn-secondary"
            onClick={() => {
              setSelected(null);
              setPin('');
              setError('');
            }}
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="container"><div className="muted">로딩…</div></div>}>
      <HomeInner />
    </Suspense>
  );
}

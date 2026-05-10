# PPE Class Game

서울대 연합전공 정치경제철학 개론 (2026 봄, 신호철) 수업용 게임 앱.

- 학생 16명이 핸드폰으로 접속해 이름+PIN으로 로그인
- 죄수의 딜레마 등 게임 진행
- 교수는 `/admin/<비밀경로>` 에서 짝 편성, 시작, 확정, 잔고 관리

## 환경 변수 (Vercel에 설정)

| 변수 | 설명 |
|---|---|
| `KV_REST_API_URL` | Upstash Redis REST URL (Vercel-Upstash 통합 시 자동 주입) |
| `KV_REST_API_TOKEN` | Upstash Redis REST 토큰 (자동 주입) |
| `ADMIN_PASSWORD` | 관리자 비밀번호 (직접 정함) |
| `ADMIN_SECRET` | 관리자 페이지 URL의 비밀 경로 (예: `ppe-2026-spring-shc`) |

## 관리 페이지 URL

`https://<your-app>.vercel.app/admin/<ADMIN_SECRET>`

## 학생 PIN 변경

기본값은 `lib/redis.js`의 `DEFAULT_STUDENTS`에 있다.
실제 학생 명단으로 바꾸려면 이 배열을 수정하고 다시 배포한 뒤,
Upstash 콘솔에서 `students` 키를 한 번 삭제하면 다음 요청 시 새 기본값이 들어간다.

## 죄수의 딜레마 진행 흐름

1. 관리자: 짝 편성 → 보수 행렬 확인 → "설정 저장"
2. 관리자: "▶ 게임 시작"
3. 학생들: 대시보드에서 "게임 입장" → 보수표 확인 → 부인/고발 선택
4. 모든 학생이 선택 제출하면 관리자에게 "결과 확정" 버튼 활성화
5. 관리자: "✓ 결과 확정" → 잔고 자동 반영
6. 다음 라운드: "↺ 초기화" → 새 페어 편성부터 반복

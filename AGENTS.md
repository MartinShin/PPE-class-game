# PPE Class Game — Project Context

서울대학교 연합전공 정치경제철학 개론 (2026 봄학기, 신호철 교수) 수업용
인터랙티브 게임 웹앱. 학생 16명이 핸드폰으로 접속해 죄수의 딜레마 등
게임 이론 수업 활동을 진행한다.

## 사용자 (교수) 프로필

- 이름: 신호철 (서울대 연합전공 정치경제철학 초빙교수)
- 기술 수준: Git/CLI 미숙. VS Code, GitHub Codespace 사용 중.
- 작업 환경: 브라우저(크롬)에서 GitHub Codespace로 코드 수정 → 커밋 → 동기화 → Vercel 자동 재배포
- 선호: 솔직하고 직설적인 답변. 비굴함·아부 싫어함. 단계별 안내 필요.

## 인프라

- **GitHub**: 이 저장소가 단일 진실 공급원(SSOT). main 브랜치에 push하면 Vercel 자동 배포.
- **Vercel**: 프로젝트명 `ppe-class-game`. Next.js 자동 감지. 환경변수 4개 설정됨.
- **Upstash Redis**: DB명 `PPE class1`. JSON 데이터 저장. 관계형 DB 아님.

## 환경 변수 (Vercel Settings에 저장됨, 코드에 없음)

| 변수 | 용도 |
|---|---|
| `KV_REST_API_URL` 또는 `UPSTASH_REDIS_REST_URL` | Upstash 연결 URL |
| `KV_REST_API_TOKEN` 또는 `UPSTASH_REDIS_REST_TOKEN` | Upstash 인증 토큰 |
| `ADMIN_PASSWORD` | 교수 관리 페이지 로그인 비밀번호 |
| `ADMIN_SECRET` | 관리 페이지 URL의 비밀 경로 (예: `/admin/<ADMIN_SECRET>`) |

⚠️ 위 값들은 절대 AI에게 알려주지 말 것. 노출 시 즉시 해당 서비스 콘솔에서 재발급(rotate).

## 기술 스택

- **Next.js 14** (App Router, JavaScript - TypeScript 아님)
- **React 18**
- **Upstash Redis** (`@upstash/redis` 패키지)
- 별도 CSS 프레임워크 없음 (`app/globals.css`에 직접 작성)
- 한글 폰트: Nanum Myeongjo (Google Fonts)

## 디렉토리 구조
app/
├─ page.js                       학생 로그인 (이름 목록 + PIN)
├─ layout.js                     루트 레이아웃, 폰트 로드
├─ globals.css                   전역 스타일 (CSS 변수 사용)
├─ student/[id]/
│  ├─ page.js                    학생 대시보드 (잔고 + 게임 진입)
│  ├─ change-pin/page.js         학생 PIN 변경 (첫 로그인 시 강제)
│  └─ pd/page.js                 죄수의 딜레마 플레이
├─ admin/[secret]/page.js        교수 관리 페이지 (대시보드 통합)
└─ api/
├─ login/route.js             학생 로그인
├─ students/route.js          학생 목록 (?test=1로 테스트학생 포함)
├─ student/[id]/route.js      학생 단건 (잔고 포함)
├─ student/change-pin/route.js
├─ pd/state/route.js          현재 게임 상태 조회
├─ pd/choice/route.js         학생 선택 제출
└─ admin/
├─ auth/route.js           관리자 로그인 (token 발급)
├─ students/route.js       관리자용 학생 목록 (PIN 포함)
├─ students/manage/route.js  학생 add/update/delete/reset-pin
├─ balance/route.js        잔고 수동 조정
└─ pd/{setup,start,confirm,reset}/route.js
lib/
├─ redis.js                      Upstash 연결 + 모든 Redis I/O 함수
└─ auth.js                       관리자 토큰 생성/검증
## Redis 데이터 구조

- `students` — 학생 목록 JSON 배열. `[{ id, name, pin, isTest }]`
  - id 규칙: 실제 학생 `s01`~, 테스트 학생 `t01`~
  - 기본 PIN은 `1111`. 학생이 첫 로그인 시 변경하도록 강제.
- `balance:<studentId>` — 학생별 누적 상금 (number, 단위: 원)
- `pd:state` — 죄수의 딜레마 현재 상태:
  - `status`: `'idle' | 'active' | 'completed'`
  - `pairs`: `[[id1, id2], ...]` 첫번째가 학생1(행), 두번째가 학생2(열)
  - `choices`: `{ studentId: 'D' | 'R' }`
  - `payoff`: `{ DD: [a,b], DR: [a,b], RD: [a,b], RR: [a,b] }` ([학생1, 학생2] 보수, 단위: 원)
  - `strategies`: `{ D: '부인', R: '고발' }` (관리자가 변경 가능. 내부 키 D/R은 고정)
  - `results`: 확정 후 채워짐
- `pd:history` — 라운드 기록 누적 배열

## 게임 진행 규약

- 죄수의 딜레마 표준 표기법:
  - 학생 1 = 행(row) = 보수 행렬 왼쪽 라벨, 학생 2 = 열(col) = 위쪽 라벨
  - 각 셀에서 학생 1 보수는 **왼쪽 아래**(초록), 학생 2 보수는 **오른쪽 위**(빨강)
- 페이오프 단위는 **원**. 학생들에게 실제 상금으로 지급하는 것이 가능하도록 설계.
- 짝 편성, 게임 시작, 결과 확정은 모두 admin에서 수동 트리거.

## 보안 모델 (수업용 수준, 완벽하지 않음)

- 학생: 이름 클릭 + 4자리 PIN. 평문 저장 (수업용이라 의도적).
- 관리자: URL 비밀 경로 (`ADMIN_SECRET`) + 비밀번호 (`ADMIN_PASSWORD`)의 이중 보호.
  - 토큰은 base64(secret:password) 형태로 sessionStorage에 저장.
- 학생 화면에서는 PIN 절대 노출 안 함. 관리자 화면에서는 기본 PIN(1111)인 학생만 표시.
- 테스트 학생(isTest=true)은 학생 로그인 화면에서 숨김. `?test=1` 쿼리로만 표시.

## 자주 하는 작업 패턴

### 작은 변경 (한두 줄, CSS, 텍스트)
→ Codespace에서 직접 파일 편집 → 소스 제어 패널에서 커밋 → 동기화

### 큰 변경 (여러 파일, 새 기능)
→ AI에게 작업 시켜 ZIP 받기 → Codespace에 풀어서 덮어쓰기 → 커밋 → 동기화
→ 절차:
```bash
cd /workspaces/PPE-class-game
ls -A | grep -v '^\.git$' | xargs rm -rf
# (ZIP 업로드 후)
unzip ppe-class-game-vN.zip
mv ppe-class-game/* .
mv ppe-class-game/.gitignore ppe-class-game/.env.local.example .
rmdir ppe-class-game
rm ppe-class-game-vN.zip
```

### 학생 명단 / PIN / 페이오프 / 전략 이름 변경
→ 코드 수정 불필요. **관리자 페이지에서 직접** 수정.

## 알려진 한계 / 향후 개선 가능 사항

- 동시성: 두 학생이 정확히 같은 순간 선택 제출 시 한 명이 덮어쓰일 가능성 (Redis 트랜잭션 미사용). 16명 규모에서 실제로 거의 안 일어남.
- PIN 평문 저장: 수업용으로 의도. 운영급으로 키우려면 해싱 필요.
- 학생끼리 PIN을 알면 도용 가능. 추가 보안이 필요하면 학번 기반 인증 등 도입 고려.
- 죄수의 딜레마 외 다른 게임은 아직 미구현. 추가 시 `app/api/<game>/`, `app/student/[id]/<game>/`, admin 페이지에 섹션 추가 필요.

## 다른 AI에게 이 프로젝트를 맡길 때

1. 이 `AGENTS.md` 파일을 읽혀라.
2. GitHub 저장소 URL을 주고 코드를 직접 읽게 해라.
3. 수정 사항이 작으면 (한 파일, 몇 줄): 변경할 부분과 새 코드만 명확히 보여달라고 해라.
4. 수정 사항이 크면: 전체 ZIP을 만들어 달라고 해라. 위의 "큰 변경" 절차 사용.
5. 환경변수 값은 절대 알려주지 마라.
6. 이미 빌드 검증 (`next build`) 한 다음에 결과를 받아라.
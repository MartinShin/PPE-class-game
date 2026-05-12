# PPE Class Game — Project Context

서울대학교 연합전공 정치경제철학 개론 (2026 봄학기, 신호철 교수) 수업용
인터랙티브 게임 웹앱. 학생 16명이 핸드폰으로 접속해 게임 이론 수업 활동을 진행한다.

> 마지막 업데이트: 2026-05 (게임 1 · 최저가 입찰 게임 추가 시점)

## 사용자 (교수) 프로필

- 이름: 신호철 (서울대 연합전공 정치경제철학 초빙교수)
- 기술 수준: Git/CLI 미숙. VS Code, GitHub Codespace 사용 중.
- 작업 환경: 브라우저(크롬)에서 GitHub Codespace로 코드 수정 → 커밋 → 동기화 → Vercel 자동 재배포
- 선호: 단계별 안내 필요.

## 인프라

- **GitHub**: 이 저장소가 단일 진실 공급원(SSOT). main 브랜치에 push하면 Vercel 자동 배포.
- **Vercel**: 프로젝트명 `ppe-class-game`. Next.js 자동 감지. 환경변수 4개 설정됨. 배포 URL: https://ppe-class-game.vercel.app/
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

- **Next.js 14** (App Router, JavaScript — TypeScript 아님)
- **React 18**
- **Upstash Redis** (`@upstash/redis` 패키지)
- 별도 CSS 프레임워크 없음 (`app/globals.css`에 직접 작성). **Tailwind 사용 안 함.**
- 한글 폰트: Nanum Myeongjo (Google Fonts)

## 디렉토리 구조

```
app/
├─ page.js                       학생 로그인 (이름 목록 + PIN)
├─ layout.js                     루트 레이아웃, 폰트 로드
├─ globals.css                   전역 스타일 (CSS 변수 사용)
├─ student/[id]/
│  ├─ page.js                    학생 대시보드 (잔고 + 게임 1/2 카드)
│  ├─ change-pin/page.js         학생 PIN 변경 (첫 로그인 시 강제)
│  ├─ pd/page.js                 게임 2: 죄수의 딜레마 플레이
│  └─ bid/page.js                게임 1: 최저가 입찰 게임 플레이
├─ admin/[secret]/page.js        교수 관리 페이지 (모든 게임 통합)
└─ api/
   ├─ login/route.js                       학생 로그인
   ├─ students/route.js                    학생 목록 (?test=1로 테스트학생 포함)
   ├─ student/[id]/route.js                학생 단건 (잔고 포함)
   ├─ student/change-pin/route.js
   ├─ pd/state/route.js                    게임 2 상태 조회
   ├─ pd/choice/route.js                   게임 2 선택 제출
   ├─ bid/state/route.js                   게임 1 상태 조회
   ├─ bid/submit/route.js                  게임 1 숫자 제출
   └─ admin/
      ├─ auth/route.js                     관리자 로그인 (token 발급)
      ├─ students/route.js                 관리자용 학생 목록 (PIN 포함)
      ├─ students/manage/route.js          학생 add/update/delete/reset-pin
      ├─ balance/route.js                  잔고 수동 조정
      ├─ pd/{setup,start,confirm,reset}/route.js     게임 2 관리
      └─ bid/{setup,start,confirm,reset}/route.js    게임 1 관리

lib/
├─ redis.js                      Upstash 연결 + 모든 Redis I/O 함수
└─ auth.js                       관리자 토큰 생성/검증
```

## Redis 데이터 구조

- `students` — 학생 목록 JSON 배열. `[{ id, name, pin, isTest }]`
  - id 규칙: 실제 학생 `s01`~, 테스트 학생 `t01`~
  - 기본 PIN은 `1111`. 학생이 첫 로그인 시 변경하도록 강제.
- `balance:<studentId>` — 학생별 누적 상금 (number, 단위: 원, **소수점 1자리까지 허용**)
- `pd:state` — 게임 2 (죄수의 딜레마) 현재 상태:
  - `status`: `'idle' | 'active' | 'completed'`
  - `pairs`: `[[id1, id2], ...]` 첫번째가 학생1(행), 두번째가 학생2(열)
  - `choices`: `{ studentId: 'D' | 'R' }`
  - `payoff`: `{ DD: [a,b], DR: [a,b], RD: [a,b], RR: [a,b] }` ([학생1, 학생2] 보수, 단위: 원, 정수)
  - `strategies`: `{ D: '부인', R: '고발' }` (관리자가 변경 가능. 내부 키 D/R은 고정)
  - `results`: 확정 후 채워짐
- `pd:history` — 게임 2 라운드 기록 누적 배열
- `bid:state` — 게임 1 (최저가 입찰) 현재 상태:
  - `status`: `'idle' | 'active' | 'completed'`
  - `round`: 누적 라운드 번호
  - `settings`: `{ min, max, showWinnerNames }` — 기본 `{ 0, 10000, false }`
  - `bids`: `{ studentId: number }` 학생별 제출 숫자
  - `results`: 확정 후 `{ lowestBid, winnerIds, winnerNames, winnerCount, prizePerWinner, payoffs }`
  - `startedAt`, `completedAt`: timestamp
- `bid:history` — 게임 1 라운드 기록 누적 배열

## 게임 진행 규약

### 공통

- 페이오프 단위는 **원**. 학생들에게 실제 상금으로 지급하는 것이 가능하도록 설계.
- 짝 편성, 게임 시작, 결과 확정은 모두 admin에서 수동 트리거.

### 게임 1 · 최저가 입찰 게임

- 학생들이 동시에 `min` 이상 `max` 이하의 자연수(0 포함, 정수만)를 비공개 제출.
- 한 번 제출하면 수정 불가.
- 가장 작은 숫자를 쓴 학생(들)이 우승.
- 우승자 1명이면 본인이 쓴 숫자만큼 상금.
- 우승자 N명이면 각자 `lowestBid / N`. **소수점 첫째 자리에서 버림** (`floorToOneDecimal()`).
- 최저 숫자는 학생 화면에 항상 공개.
- 우승자 이름은 `settings.showWinnerNames`에 따라 실명 또는 익명("익명 N명").
- 전체 제출 숫자 목록은 **교수 화면에서만** 공개 (공정성 보호).
- 결과 확정 시 실제 학생 전원 제출을 기다리는 것이 원칙이지만, **테스트 학생만 제출해도 확정 가능** (교수 테스트 편의).

### 게임 2 · 죄수의 딜레마 표기 규약

- 학생 1 = **행(row)** = 보수 행렬 왼쪽 라벨
- 학생 2 = **열(col)** = 보수 행렬 위쪽 라벨
- 각 셀에서 학생 1 보수는 **왼쪽 아래**(초록), 학생 2 보수는 **오른쪽 위**(빨강)
- 보수는 항상 정수

## 코드 패턴

### 관리자 인증

두 가지 패턴이 공존함. 일관성보다 동작 우선이므로 둘 다 유지.

**패턴 A — `@/lib/auth` 헬퍼 사용 (게임 2 admin API):**
```js
import { verifyAdminToken } from '@/lib/auth';
// 함수 이름은 실제 lib/auth.js를 확인
```

**패턴 B — 인라인 검증 (게임 1 admin API):**
```js
function verifyAdmin(secret, token) {
  if (!process.env.ADMIN_SECRET || !process.env.ADMIN_PASSWORD) return false;
  if (secret !== process.env.ADMIN_SECRET) return false;
  const expected = Buffer.from(
    `${process.env.ADMIN_SECRET}:${process.env.ADMIN_PASSWORD}`
  ).toString('base64');
  return token === expected;
}
```

새 게임 추가 시는 패턴 A 권장 (의존성 일관). 패턴 B는 `lib/auth.js`를 모를 때 안전한 대안.

### API 응답 포맷

```js
return Response.json({ ok: true, ...data });
return Response.json({ ok: false, error: '메시지' });
return Response.json({ ok: false, error: '인증 실패' }, { status: 401 });
```

### 학생용 API의 정보 노출 제한

학생용 API는 **다른 학생의 제출값을 절대 반환하지 않음.** 예시: `/api/bid/state?studentId=s01` 응답은 본인 제출값만 포함. 관리자용은 `?admin=1` 쿼리로 구분.

### 클라이언트 폴링

학생 페이지와 관리자 페이지 모두 **4초 간격 polling** (`setInterval(refresh, 4000)`). WebSocket 미사용 (수업 규모 20명이면 충분).

### 잔고는 항상 헬퍼로

```js
// 좋음
import { addBalance } from '@/lib/redis';
await addBalance(studentId, 500);   // 소수점 1자리 처리됨

// 나쁨 - 소수점 처리 안 됨
await redis.incrby(`balance:${studentId}`, 500);
```

## 보안 모델 (수업용 수준, 완벽하지 않음)

- 학생: 이름 클릭 + 4자리 PIN. 평문 저장 (수업용이라 의도적).
- 관리자: URL 비밀 경로 (`ADMIN_SECRET`) + 비밀번호 (`ADMIN_PASSWORD`)의 이중 보호.
  - 토큰은 base64(secret:password) 형태로 sessionStorage에 저장.
- 학생 화면에서는 PIN 절대 노출 안 함. 관리자 화면에서는 기본 PIN(1111)인 학생만 표시.
- 테스트 학생(isTest=true)은 학생 로그인 화면에서 숨김. `?test=1` 쿼리로만 표시.

## 자주 하는 작업 패턴

### 작은 변경 (한두 줄, CSS, 텍스트, 라벨)

→ Codespace에서 직접 파일 편집 → 소스 제어 패널에서 커밋 → 동기화

### 중간 변경 — 부분 패치 ZIP (파일 몇 개 추가/수정)

게임 1 추가가 이 경우. AI에게 변경된/새 파일만 폴더 구조 보존해서 ZIP으로 받기 → **청소하지 말고** 머지.

```bash
cd /workspaces/PPE-class-game
# (ZIP 업로드 후)
unzip patch.zip
cp -r <폴더이름>/* .          # 동일 경로 덮어쓰기 + 새 파일 추가
rm -rf <폴더이름> patch.zip
npm run build                # 빌드 검증
git add . && git commit -m "..." && git push origin main
```

⚠️ **이 경우 절대 청소하지 말 것.** 기존 죄수의 딜레마 코드 등이 다 사라짐.

### 큰 변경 — 전체 교체 ZIP (저장소 통째 마이그레이션)

AI에게 전체 프로젝트를 새로 만들어 달라고 함 → **청소 후 풀기**.

```bash
cd /workspaces/PPE-class-game
ls -A | grep -v '^\.git$' | xargs rm -rf
# (ZIP 업로드 후)
unzip ppe-class-game-vN.zip
mv ppe-class-game/* .
mv ppe-class-game/.gitignore ppe-class-game/.env.local.example .
rmdir ppe-class-game
rm ppe-class-game-vN.zip
npm run build
git add . && git commit -m "..." && git push origin main
```

이건 ChatGPT가 죄수의 딜레마를 처음 만들 때 사용한 방식.

### 학생 명단 / PIN / 페이오프 / 전략 이름 / 입찰 게임 설정 변경

→ 코드 수정 불필요. **관리자 페이지에서 직접** 수정.

## 새 게임 추가하는 방법 (게임 3 만들 때)

게임 1 추가 패턴을 그대로 따라가면 됨.

1. **`lib/redis.js`** 에 추가
   - `K` 객체에 `newGameState`, `newGameHistory` 추가
   - `DEFAULT_<NEWGAME>_SETTINGS` 정의
   - `getNewGameState()`, `setNewGameState()`, `pushNewGameHistory()` 추가
2. **학생용 API 2개**: `app/api/<newgame>/state/route.js`, `app/api/<newgame>/submit/route.js` (또는 적합한 액션명)
3. **관리자용 API 4개**: `app/api/admin/<newgame>/{setup,start,confirm,reset}/route.js`
4. **학생 페이지**: `app/student/[id]/<newgame>/page.js`
5. **학생 대시보드** (`app/student/[id]/page.js`) 의 `refresh()` 에 새 게임 state fetch 추가, UI에 새 카드 추가
6. **관리자 페이지** (`app/admin/[secret]/page.js`) 의 `refresh()` 에 fetch 추가, UI에 새 섹션 추가
7. **AGENTS.md** 의 게임 진행 규약·디렉토리 구조·Redis 데이터 구조 절을 갱신
8. `npm run build` 통과 확인 후 commit & push

### 게임 추가 시 자주 까먹는 것

- 두 `refresh()` 함수에 새 fetch 추가 (학생 대시보드, 관리자 페이지)
- 잔고는 정수가 아닐 수 있으므로 `Math.floor()` 직접 쓰지 말고 `floorToOneDecimal()` 사용
- 관리자 페이지의 게임 컨트롤 카드 순서: 게임 1이 위, 게임 2가 아래 — 학생 화면과 통일

## 학생 / 관리자 접속

- **학생 (수업용):** https://ppe-class-game.vercel.app/ (QR 코드 포스터 별도 보관)
- **학생 (테스트 모드):** https://ppe-class-game.vercel.app/?test=1 — 테스트 학생도 로그인 가능
- **관리자:** https://ppe-class-game.vercel.app/admin/<ADMIN_SECRET>

## 알려진 한계 / 향후 개선 가능 사항

- **동시성**: 두 학생이 정확히 같은 순간 선택/제출 시 한 명이 덮어쓰일 가능성 (Redis 트랜잭션 미사용). 16명 규모에서 실제로 거의 안 일어남.
- **PIN 평문 저장**: 수업용으로 의도. 운영급으로 키우려면 해싱 필요.
- **PIN 도용**: 학생끼리 PIN을 알면 도용 가능. 추가 보안이 필요하면 학번 기반 인증 등 도입 고려.
- **히스토리 UI 없음**: `bid:history`, `pd:history`에 누적되지만 관리자/학생 화면에서 이전 라운드를 조회하는 페이지 없음. 필요하면 admin 페이지에 추가.
- **Upstash Free Plan**: 학생 60명 이상 동시 접속 시 rate limit 위험. 현재 20명 규모는 안전.
- **새 게임 미구현**: 게임 1, 2 외 다른 게임은 위 "새 게임 추가하는 방법" 절차 참고.

## 다른 AI에게 이 프로젝트를 맡길 때

1. 이 `AGENTS.md` 파일을 끝까지 읽혀라.
2. GitHub 저장소 URL을 주고 필요한 코드는 직접 읽게 해라.
3. 수정 사항이 작으면 (한 파일, 몇 줄): 변경할 부분과 새 코드만 명확히 보여달라고 해라.
4. 수정 사항이 중간이면 (파일 몇 개 추가/수정): 부분 패치 ZIP 요청. "큰 변경" 절차의 청소 단계는 **건너뛸 것**.
5. 수정 사항이 매우 크면 (저장소 마이그레이션): 전체 ZIP 요청. "큰 변경" 절차 사용.
6. 환경변수 값은 절대 알려주지 마라.
7. AI가 작업한 결과는 `npm run build`로 빌드 검증 후 commit & push.
8. AI가 "GitHub에 push 했다"고 보고해도 곧이곧대로 믿지 말 것. Codespace에서 `git pull --rebase origin main` 으로 직접 확인.

## 수업 운영 노트

- 수업명: 정치경제철학 개론 / 학기: 2026년 1학기
- 수업은 토론식. 학생 발언 1회당 1점 가산 — 게임 점수와는 별도 트랙. 게임은 토론 자료로도 활용.
- 학생 수: 16명 (필요 시 +몇 명 변동 가능).

# 최저가 입찰 게임 (게임 1) — 적용 가이드

이 ZIP에는 **새로 추가할 파일 5개**와 **덮어쓸 파일 2개**가 들어있습니다.

## 들어있는 파일

### 새로 추가 (5개)
- `app/api/admin/bid/setup/route.js`
- `app/api/admin/bid/start/route.js`
- `app/api/admin/bid/confirm/route.js`
- `app/api/admin/bid/reset/route.js`
- `app/student/[id]/bid/page.js`

### 기존 파일 덮어쓰기 (2개)
- `app/student/[id]/page.js`  ← 게임 1 카드 추가됨
- `app/admin/[secret]/page.js` ← 게임 1 섹션 추가됨

### ⚠️ `lib/redis.js` 는 이미 ChatGPT가 수정했으므로 **건드리지 않습니다.**
### ⚠️ `app/api/bid/state/route.js`, `app/api/bid/submit/route.js` 도 이미 ChatGPT가 만들었으므로 **건드리지 않습니다.**

---

## Codespace에서 적용하는 방법

### 방법 A — ZIP을 그대로 풀어쓰기 (추천)

GitHub Codespace 터미널에서:

```bash
cd /workspaces/PPE-class-game

# (ZIP을 Codespace에 업로드한 뒤)
unzip bid-game-patch.zip

# 풀린 폴더를 현재 프로젝트에 머지
cp -r bid-game/* .

# 정리
rm -rf bid-game bid-game-patch.zip
```

`cp -r` 는 같은 경로의 기존 파일을 덮어쓰고, 새 파일은 새로 만듭니다.
폴더 구조가 일치하므로 안전합니다.

### 방법 B — 파일 하나씩 복사

Codespace 파일 탐색기에서 각 파일을 새로 만들거나 열어서
ZIP 안의 내용을 붙여넣기.

---

## 적용 후 확인 (Codespace 터미널)

```bash
npm run build
```

빌드가 통과하면 git에 커밋:

```bash
git add .
git commit -m "feat: add lowest-bid auction game (Game 1)"
git push origin main
```

Vercel이 자동 배포합니다 (1~2분).

---

## 동작 확인 순서 (Vercel 배포 후)

1. **관리자 페이지** 접속 → 새로 생긴 **"게임 1 · 최저가 입찰 게임"** 섹션 확인
2. 최소값 / 최대값 / 익명·실명 선택 → **설정 저장**
3. **▶ 게임 시작** 클릭
4. 학생 화면에서 → 대시보드에 **게임 1 카드** 보이는지 확인 → **게임 입장** → 숫자 제출
5. 관리자 화면에서 **제출 현황** 실시간으로 확인 (4초마다 갱신)
6. 모두 제출되면 **✓ 결과 확정** 클릭 → 우승자 잔고 자동 반영
7. 학생 화면에 결과 표시 (최저 숫자 / 내 상금 / 우승자)
8. **↺ 초기화** 후 다음 라운드 가능

---

## 게임 2 (죄수의 딜레마)는 그대로 작동합니다

수정된 페이지에서도 죄수의 딜레마 로직은 한 줄도 안 바뀌었습니다.
타이틀만 "죄수의 딜레마" → "게임 2 · 죄수의 딜레마"로 라벨 추가됐을 뿐.

---

## 문제가 생기면

- **빌드 에러가 나는 경우**: 가장 흔한 이유는 `lib/auth.js`의 인증 함수와 충돌. 이 ZIP의 admin API들은 외부 의존성 없이 인라인으로 인증을 처리하므로, `lib/auth.js`와 무관하게 작동합니다.
- **인증 실패가 뜨는 경우**: Vercel의 환경변수 `ADMIN_SECRET`, `ADMIN_PASSWORD`가 제대로 들어가 있는지 확인.
- **결과 확정 시 상금이 안 들어가는 경우**: `lib/redis.js`의 `addBalance` 함수가 ChatGPT가 수정한 소수점 버전인지 확인.

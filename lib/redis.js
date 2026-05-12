import { Redis } from '@upstash/redis';

const url =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;
const token =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = new Redis({ url, token });

// ---------- Key 정의 ----------
export const K = {
  students: 'students',
  balance: (id) => `balance:${id}`,
  bidState: 'bid:state',
  bidHistory: 'bid:history',
  pdState: 'pd:state',
  pdHistory: 'pd:history',
  pgState: 'pg:state',
  pgHistory: 'pg:history',
};

// ---------- 학생 ----------
// PIN은 모두 '1111' 기본값. 학생이 첫 로그인 후 직접 바꿈.
const DEFAULT_STUDENTS = [
  { id: 's01', name: '김민준', pin: '1111', isTest: false },
  { id: 's02', name: '이서연', pin: '1111', isTest: false },
  { id: 's03', name: '박지호', pin: '1111', isTest: false },
  { id: 's04', name: '최수아', pin: '1111', isTest: false },
  { id: 's05', name: '정도윤', pin: '1111', isTest: false },
  { id: 's06', name: '강하은', pin: '1111', isTest: false },
  { id: 's07', name: '윤예준', pin: '1111', isTest: false },
  { id: 's08', name: '임채원', pin: '1111', isTest: false },
  { id: 's09', name: '조시우', pin: '1111', isTest: false },
  { id: 's10', name: '한지유', pin: '1111', isTest: false },
  { id: 's11', name: '오건우', pin: '1111', isTest: false },
  { id: 's12', name: '서윤서', pin: '1111', isTest: false },
  { id: 's13', name: '신유나', pin: '1111', isTest: false },
  { id: 's14', name: '홍지환', pin: '1111', isTest: false },
  { id: 's15', name: '백다은', pin: '1111', isTest: false },
  { id: 's16', name: '문선우', pin: '1111', isTest: false },
  // 테스트용 가짜 학생 4명 — 학생 화면에는 표시되지 않고 관리 페이지에서만 보임
  { id: 't01', name: '테스트1', pin: '1111', isTest: true },
  { id: 't02', name: '테스트2', pin: '1111', isTest: true },
  { id: 't03', name: '조교1',   pin: '1111', isTest: true },
  { id: 't04', name: '조교2',   pin: '1111', isTest: true },
];

const DEFAULT_BID_SETTINGS = {
  min: 0,
  max: 10000,
  showWinnerNames: false,
};

const DEFAULT_PAYOFF = {
  DD: [1000, 1000],
  DR: [0, 10000],
  RD: [10000, 0],
  RR: [5000, 5000],
};

// 전략 이름 (관리자가 변경 가능). 내부 키 'D','R'은 고정.
const DEFAULT_STRATEGIES = { D: '부인', R: '고발' };

// ---------- 게임 3: 공공재 게임 기본값 ----------
// 환율은 1달러 = 1500원 (CORE 교재 기준). 관리자가 admin에서 변경 가능.
// 이산형 (관개 게임): C = $10 = 15,000원, B = $8 = 12,000원
// 연속형 (실험): endowment = $20 = 30,000원, MPCR = 0.4
const DEFAULT_PG_SETTINGS = {
  mode: 'discrete',          // 'discrete' (관개 게임) | 'continuous' (실험)
  cost: 15000,               // 이산형 기여 비용 (원)
  benefit: 12000,            // 이산형 기여당 인당 편익 (원)
  endowment: 30000,          // 연속형 라운드별 자금 (원)
  mpcr: 0.4,                 // 연속형 MPCR
  increment: 100,            // 연속형 기여 입력 단위 (원)
  numRounds: 1,              // 총 라운드 수
  punishmentEnabled: false,  // 처벌 단계
  punishmentCost: 1000,      // 처벌 1포인트당 가해자 비용
  punishmentEffect: 3000,    // 처벌 1포인트당 피해자 차감
  punishmentMax: 10,         // 한 학생이 한 멤버에게 줄 수 있는 최대 처벌 포인트
  exchangeRate: 1500,        // 1달러당 원 (참고 표시용)
  strategies: { C: '기여하기', N: '기여하지 않기' }, // 이산형 라벨
};

function toOneDecimal(n) {
  return Math.round(Number(n) * 10) / 10;
}

export function floorToOneDecimal(n) {
  return Math.floor(Number(n) * 10) / 10;
}

export async function getStudents() {
  const data = await redis.get(K.students);
  if (!data) {
    await redis.set(K.students, DEFAULT_STUDENTS);
    return DEFAULT_STUDENTS;
  }
  const arr = typeof data === 'string' ? JSON.parse(data) : data;
  // 기존 데이터에 isTest 필드가 없으면 false로 보강 (구버전 호환)
  return arr.map((s) => ({ isTest: false, ...s }));
}

export async function setStudents(students) {
  await redis.set(K.students, students);
}

export async function getStudent(id) {
  const students = await getStudents();
  return students.find((s) => s.id === id) || null;
}

// 학생 정보 업데이트 (이름, PIN, isTest 등)
export async function updateStudent(id, patch) {
  const students = await getStudents();
  const idx = students.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  students[idx] = { ...students[idx], ...patch };
  await setStudents(students);
  return students[idx];
}

export async function addStudent(student) {
  const students = await getStudents();
  if (students.some((s) => s.id === student.id)) return null;
  students.push({ pin: '1111', isTest: false, ...student });
  await setStudents(students);
  return student;
}

export async function deleteStudent(id) {
  const students = await getStudents();
  const next = students.filter((s) => s.id !== id);
  if (next.length === students.length) return false;
  await setStudents(next);
  await redis.del(K.balance(id));
  return true;
}

// 다음 사용 가능한 ID (s17, t05 등)
export async function nextStudentId(isTest = false) {
  const students = await getStudents();
  const prefix = isTest ? 't' : 's';
  let n = 1;
  while (students.some((s) => s.id === `${prefix}${String(n).padStart(2, '0')}`)) n++;
  return `${prefix}${String(n).padStart(2, '0')}`;
}

// ---------- 상금 잔고 ----------
export async function getBalance(studentId) {
  const v = await redis.get(K.balance(studentId));
  return v ? Number(v) : 0;
}

export async function addBalance(studentId, amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return await getBalance(studentId);

  const current = await getBalance(studentId);
  const next = toOneDecimal(current + n);
  await redis.set(K.balance(studentId), next);
  return next;
}

export async function setBalance(studentId, amount) {
  await redis.set(K.balance(studentId), toOneDecimal(amount));
}

// ---------- 게임 1: 최저가 입찰 게임 ----------
export async function getBidState() {
  const data = await redis.get(K.bidState);
  if (!data) {
    const init = {
      status: 'idle',
      round: 0,
      settings: DEFAULT_BID_SETTINGS,
      bids: {},
      results: null,
      startedAt: null,
      completedAt: null,
    };
    await redis.set(K.bidState, init);
    return init;
  }

  const state = typeof data === 'string' ? JSON.parse(data) : data;
  if (!state.settings) state.settings = DEFAULT_BID_SETTINGS;
  state.settings = { ...DEFAULT_BID_SETTINGS, ...state.settings };
  if (!state.bids) state.bids = {};
  if (typeof state.round !== 'number') state.round = 0;
  return state;
}

export async function setBidState(state) {
  await redis.set(K.bidState, state);
}

export async function pushBidHistory(record) {
  const data = await redis.get(K.bidHistory);
  const arr = data ? (typeof data === 'string' ? JSON.parse(data) : data) : [];
  arr.push(record);
  await redis.set(K.bidHistory, arr);
}

// ---------- 게임 2: 죄수의 딜레마 ----------
export async function getPdState() {
  const data = await redis.get(K.pdState);
  if (!data) {
    const init = {
      status: 'idle',
      round: 0,
      pairs: [],
      choices: {},
      payoff: DEFAULT_PAYOFF,
      strategies: DEFAULT_STRATEGIES,
      results: null,
      startedAt: null,
    };
    await redis.set(K.pdState, init);
    return init;
  }
  const state = typeof data === 'string' ? JSON.parse(data) : data;
  // 기존 데이터에 strategies가 없으면 보강 (구버전 호환)
  if (!state.strategies) state.strategies = DEFAULT_STRATEGIES;
  return state;
}

export async function setPdState(state) {
  await redis.set(K.pdState, state);
}

export async function pushPdHistory(record) {
  const data = await redis.get(K.pdHistory);
  const arr = data ? (typeof data === 'string' ? JSON.parse(data) : data) : [];
  arr.push(record);
  await redis.set(K.pdHistory, arr);
}

// ---------- 게임 3: 공공재 게임 ----------
// status: 'idle' (대기/설정 가능)
//       | 'active' (현재 라운드 진행 중, 학생 기여 입력 단계)
//       | 'punishing' (처벌 단계, 처벌 ON일 때만 사용)
//       | 'completed' (현재 라운드 종료, admin이 다음 라운드 또는 종료 선택)
//       | 'finished' (모든 라운드 종료)
export async function getPgState() {
  const data = await redis.get(K.pgState);
  if (!data) {
    const init = {
      status: 'idle',
      settings: DEFAULT_PG_SETTINGS,
      currentRound: 0,        // 0 = 미시작, 1..numRounds = 진행 중
      groups: [],             // [[id, id, ...], [id, id, ...], ...]
      contributions: {},      // { studentId: 'C'|'N' (이산형) | number (연속형) }
      punishments: {},        // { punisherId: { targetId: points } }
      results: null,          // 현재 라운드 결과. confirm 후 채워짐
      startedAt: null,
      completedAt: null,
    };
    await redis.set(K.pgState, init);
    return init;
  }
  const state = typeof data === 'string' ? JSON.parse(data) : data;
  // 구버전 호환: 누락된 필드 보강
  state.settings = { ...DEFAULT_PG_SETTINGS, ...(state.settings || {}) };
  if (!state.settings.strategies) state.settings.strategies = DEFAULT_PG_SETTINGS.strategies;
  if (!state.groups) state.groups = [];
  if (!state.contributions) state.contributions = {};
  if (!state.punishments) state.punishments = {};
  if (typeof state.currentRound !== 'number') state.currentRound = 0;
  return state;
}

export async function setPgState(state) {
  await redis.set(K.pgState, state);
}

export async function pushPgHistory(record) {
  const data = await redis.get(K.pgHistory);
  const arr = data ? (typeof data === 'string' ? JSON.parse(data) : data) : [];
  arr.push(record);
  await redis.set(K.pgHistory, arr);
}

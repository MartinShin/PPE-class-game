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
  pdState: 'pd:state',
  pdHistory: 'pd:history',
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

const DEFAULT_PAYOFF = {
  DD: [1000, 1000],
  DR: [0, 10000],
  RD: [10000, 0],
  RR: [5000, 5000],
};

// 전략 이름 (관리자가 변경 가능). 내부 키 'D','R'은 고정.
const DEFAULT_STRATEGIES = { D: '부인', R: '고발' };

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
  return await redis.incrby(K.balance(studentId), amount);
}

export async function setBalance(studentId, amount) {
  await redis.set(K.balance(studentId), amount);
}

// ---------- 죄수의 딜레마 ----------
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

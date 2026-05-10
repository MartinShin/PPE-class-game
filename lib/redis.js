import { Redis } from '@upstash/redis';

// Vercel-Upstash 통합은 KV_REST_API_URL/TOKEN 또는 UPSTASH_REDIS_REST_URL/TOKEN 환경변수를 자동 주입한다.
const url =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;
const token =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = new Redis({ url, token });

// ---------- Key 정의 ----------
export const K = {
  students: 'students',                 // 학생 목록 (JSON 배열)
  balance: (id) => `balance:${id}`,     // 학생별 누적 상금 (number)
  pdState: 'pd:state',                  // 죄수의 딜레마 현재 상태 (JSON)
  pdHistory: 'pd:history',              // 라운드 기록 (JSON 배열)
};

// ---------- 학생 ----------
const DEFAULT_STUDENTS = [
  { id: 's01', name: '김민준', pin: '1111' },
  { id: 's02', name: '이서연', pin: '2222' },
  { id: 's03', name: '박지호', pin: '3333' },
  { id: 's04', name: '최수아', pin: '4444' },
  { id: 's05', name: '정도윤', pin: '5555' },
  { id: 's06', name: '강하은', pin: '6666' },
  { id: 's07', name: '윤예준', pin: '7777' },
  { id: 's08', name: '임채원', pin: '8888' },
  { id: 's09', name: '조시우', pin: '9999' },
  { id: 's10', name: '한지유', pin: '1212' },
  { id: 's11', name: '오건우', pin: '1313' },
  { id: 's12', name: '서윤서', pin: '1414' },
  { id: 's13', name: '신유나', pin: '1515' },
  { id: 's14', name: '홍지환', pin: '1616' },
  { id: 's15', name: '백다은', pin: '1717' },
  { id: 's16', name: '문선우', pin: '1818' },
];

const DEFAULT_PAYOFF = {
  // [행 학생 보수, 열 학생 보수] - 단위: 원
  DD: [1000, 1000],   // 행 부인, 열 부인
  DR: [0, 10000],     // 행 부인, 열 고발
  RD: [10000, 0],     // 행 고발, 열 부인
  RR: [5000, 5000],   // 행 고발, 열 고발
};

export async function getStudents() {
  const data = await redis.get(K.students);
  if (!data) {
    await redis.set(K.students, DEFAULT_STUDENTS);
    return DEFAULT_STUDENTS;
  }
  // Upstash는 자동으로 JSON 파싱해주는데, 문자열로 들어오는 경우 대비
  return typeof data === 'string' ? JSON.parse(data) : data;
}

export async function setStudents(students) {
  await redis.set(K.students, students);
}

export async function getStudent(id) {
  const students = await getStudents();
  return students.find((s) => s.id === id) || null;
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

// ---------- 죄수의 딜레마 게임 상태 ----------
export async function getPdState() {
  const data = await redis.get(K.pdState);
  if (!data) {
    const init = {
      status: 'idle',          // 'idle' | 'active' | 'completed'
      round: 0,
      pairs: [],               // [[id1,id2], ...]
      choices: {},             // {studentId: 'D' | 'R'}
      payoff: DEFAULT_PAYOFF,
      results: null,           // 확정 후 채워짐
      startedAt: null,
    };
    await redis.set(K.pdState, init);
    return init;
  }
  return typeof data === 'string' ? JSON.parse(data) : data;
}

export async function setPdState(state) {
  await redis.set(K.pdState, state);
}

export async function pushPdHistory(record) {
  const data = await redis.get(K.pdHistory);
  const arr = data
    ? (typeof data === 'string' ? JSON.parse(data) : data)
    : [];
  arr.push(record);
  await redis.set(K.pdHistory, arr);
}

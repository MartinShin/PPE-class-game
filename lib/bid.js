import { redis } from '@/lib/redis';

const BID_STATE_KEY = 'bid:state';
const BID_HISTORY_KEY = 'bid:history';

const DEFAULT_BID_STATE = {
  status: 'idle',
  round: 0,
  minBid: 0,
  maxBid: 10000,
  visibility: 'anonymous', // 'anonymous' | 'realname'
  participantMode: 'real', // 'real' | 'test' | 'all'
  participants: [],
  submissions: {},
  results: null,
  startedAt: null,
  completedAt: null,
};

export function normalizeBidState(state) {
  return {
    ...DEFAULT_BID_STATE,
    ...(state || {}),
    minBid: Number.isFinite(Number(state?.minBid)) ? Number(state.minBid) : DEFAULT_BID_STATE.minBid,
    maxBid: Number.isFinite(Number(state?.maxBid)) ? Number(state.maxBid) : DEFAULT_BID_STATE.maxBid,
    visibility: state?.visibility === 'realname' ? 'realname' : 'anonymous',
    participantMode: ['real', 'test', 'all'].includes(state?.participantMode) ? state.participantMode : 'real',
    participants: Array.isArray(state?.participants) ? state.participants : [],
    submissions: state?.submissions && typeof state.submissions === 'object' ? state.submissions : {},
    results: state?.results || null,
  };
}

export async function getBidState() {
  const data = await redis.get(BID_STATE_KEY);
  if (!data) {
    await redis.set(BID_STATE_KEY, DEFAULT_BID_STATE);
    return DEFAULT_BID_STATE;
  }
  const state = typeof data === 'string' ? JSON.parse(data) : data;
  return normalizeBidState(state);
}

export async function setBidState(state) {
  await redis.set(BID_STATE_KEY, normalizeBidState(state));
}

export async function pushBidHistory(record) {
  const data = await redis.get(BID_HISTORY_KEY);
  const arr = data ? (typeof data === 'string' ? JSON.parse(data) : data) : [];
  arr.push(record);
  await redis.set(BID_HISTORY_KEY, arr);
}

export function selectBidParticipants(students, mode = 'real') {
  if (mode === 'test') return students.filter((s) => s.isTest).map((s) => s.id);
  if (mode === 'all') return students.map((s) => s.id);
  return students.filter((s) => !s.isTest).map((s) => s.id);
}

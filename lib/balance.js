import { getBalance, setBalance } from '@/lib/redis';

// 최저가 입찰 게임은 0.3원처럼 소수점 한 자리 상금이 가능하다.
// 한 번이라도 소수 잔고가 생기면 Redis INCRBY가 실패할 수 있으므로
// 잔고 증가는 항상 읽고 더한 뒤 저장한다. (16명 수업용 규모)
export async function addBalanceSafe(studentId, amount) {
  const current = await getBalance(studentId);
  const next = Math.round((current + (Number(amount) || 0)) * 10) / 10;
  await setBalance(studentId, next);
  return next;
}

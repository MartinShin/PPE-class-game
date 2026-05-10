// 매우 단순한 토큰 인증. 환경변수의 ADMIN_PASSWORD + ADMIN_SECRET 조합 검사.
// (수업용 16명 규모이므로 충분. 운영급 보안이 필요하면 NextAuth 등을 써야 함.)

export function getEnv() {
  return {
    password: process.env.ADMIN_PASSWORD || '',
    secret: process.env.ADMIN_SECRET || '',
  };
}

// 관리자 토큰 = ADMIN_SECRET + ":" + ADMIN_PASSWORD 의 base64
export function makeToken() {
  const { password, secret } = getEnv();
  return Buffer.from(`${secret}:${password}`).toString('base64');
}

export function checkToken(token) {
  if (!token) return false;
  return token === makeToken();
}

// 요청에서 관리자 인증 확인 (URL 비밀 + 토큰)
export function requireAdmin(req, secretFromUrl) {
  const { secret } = getEnv();
  if (!secret || secret !== secretFromUrl) return false;
  const token = req.headers.get('x-admin-token');
  return checkToken(token);
}

export function boothCookieAttributes(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}`;
}

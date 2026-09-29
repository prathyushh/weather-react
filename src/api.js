// Session lives in sessionStorage: {access, refresh, user, role}
const KEY = 'weather-desk';
export const loadSession = () => JSON.parse(sessionStorage.getItem(KEY) || 'null');
export const saveSession = (s) => (s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY));

let onExpired = () => {};
export const setExpiredHandler = (fn) => (onExpired = fn);

async function refresh(session) {
  try {
    const d = await call('/auth/refresh', { method: 'POST', body: { refreshToken: session.refresh } }, false);
    saveSession({ ...session, access: d.accessToken });
    return true;
  } catch {
    return false;
  }
}

export async function call(url, { method = 'GET', body } = {}, retry = true) {
  const session = loadSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session && !url.startsWith('/auth')) headers.Authorization = 'Bearer ' + session.access;
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

  if (res.status === 401 && retry && session && !url.startsWith('/auth')) {
    if (await refresh(session)) return call(url, { method, body }, false);
    onExpired();
    throw Object.assign(new Error('Session expired, please log in again'), { status: 401 });
  }
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch { /* plain-text body */ }
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || (typeof data === 'string' && data) || `Request failed (${res.status})`;
    throw Object.assign(new Error(message), { status: res.status });
  }
  return data;
}

export const api = {
  register: (b) => call('/auth/register', { method: 'POST', body: b }),
  login: (b) => call('/auth/login', { method: 'POST', body: b }),
  cities: (page, size = 5) => call(`/api/cities?page=${page}&size=${size}&sort=city,asc`),
  addCity: (b) => call('/api/cities', { method: 'POST', body: b }),
  deleteCity: (id) => call(`/api/cities/${id}`, { method: 'DELETE' }),
  weather: (city, state) => call(`/api/weather?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`),
};
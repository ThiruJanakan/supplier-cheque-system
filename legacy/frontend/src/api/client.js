// Single fetch wrapper for the backend API. Attaches the JWT and normalises errors.
const TOKEN_KEY = 'chq_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = t => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Session expired.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const qs = params => {
  const clean = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '' && v !== null));
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : '';
};

export const api = {
  get: (path, params) => request(`${path}${qs(params)}`),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: path => request(path, { method: 'DELETE' }),
  downloadUrl: (path, params) => `/api${path}${qs(params)}`,
  async download(path, params, filename) {
    const res = await fetch(this.downloadUrl(path, params), { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error('Export failed.');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};

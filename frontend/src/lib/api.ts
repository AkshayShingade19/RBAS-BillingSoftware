import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { AuthTokens } from './types';

const baseURL = import.meta.env.VITE_API_URL || '/api/v1';

const TOKEN_KEY = 'ledgerly.tokens';
const USER_KEY = 'ledgerly.user';

export const tokenStore = {
  get(): AuthTokens | null {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return raw ? (JSON.parse(raw) as AuthTokens) : null;
    } catch {
      return null;
    }
  },
  set(tokens: AuthTokens) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};

export const userStore = {
  get<T>(): T | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set<T>(user: T) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(USER_KEY);
  },
};

export const api = axios.create({ baseURL });

let refreshPromise: Promise<AuthTokens> | null = null;

async function doRefresh(): Promise<AuthTokens> {
  const tokens = tokenStore.get();
  if (!tokens) throw new Error('No tokens');
  const res = await axios.post<RefreshResponse>(`${baseURL}/auth/refresh`, {
    refreshToken: tokens.refreshToken,
  });
  const next: AuthTokens = { accessToken: res.data.tokens.accessToken, refreshToken: res.data.tokens.refreshToken ?? tokens.refreshToken };
  tokenStore.set(next);
  return next;
}

interface RefreshResponse {
  tokens: AuthTokens;
  user?: unknown;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tokens = tokenStore.get();
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    if (status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise ?? doRefresh();
        await refreshPromise;
        refreshPromise = null;
        const tokens = tokenStore.get();
        if (tokens) original.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(original);
      } catch {
        refreshPromise = null;
        tokenStore.clear();
        userStore.clear();
        if (window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
      }
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) return data!.message!.join(', ');
    if (data?.message) return data.message;
    return error.message || 'Request failed';
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}

export interface ApiTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

interface LoginResponse {
  tokens: ApiTokens;
  user: {
    _id: string;
    name: string;
    email: string;
    role: string | { key: string };
    permissions?: string[];
  };
}

export function setStoredAuth(tokens: ApiTokens) {
  tokenStore.set(tokens);
}

export async function login(email: string, password: string): Promise<ApiTokens> {
  const res = await axios.post<LoginResponse>(`${baseURL}/auth/login`, { email, password });
  tokenStore.set(res.data.tokens);
  return res.data.tokens;
}

export async function downloadCsv(path: string, params: Record<string, string | number | undefined> = {}) {
  const tokens = tokenStore.get();
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') query.set(k, String(v));
  });
  const res = await axios.get<string>(`${baseURL}${path}${query.toString() ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${tokens?.accessToken}` },
  });
  const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = path.split('/').filter(Boolean).join('-') + '.csv';
  a.click();
  URL.revokeObjectURL(blobUrl);
}
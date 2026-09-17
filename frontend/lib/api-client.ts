// Fetch wrapper dùng chung cho toàn bộ frontend.
// - Tự gắn prefix /api/v1/system hoặc /api/v1/{tenant}
// - Tự gắn Authorization: Bearer <access token>
// - Parse lỗi theo format { error: { code, message } } (ARCHITECTURE.md muc 5 & 9)
// - Khi gặp 401: tự gọi refresh token (chỉ áp dụng cho scope tenant, vì
//   /system/auth hiện chỉ có endpoint login) rồi retry request đúng 1 lần.

export type ApiScope = "system" | { tenant: string };

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function storageKey(scope: ApiScope): string {
  return scope === "system" ? "mn_auth_system" : `mn_auth_${scope.tenant}`;
}

export function readAuth(scope: ApiScope): StoredAuth | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeAuth(scope: ApiScope, auth: StoredAuth): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(storageKey(scope), JSON.stringify(auth));
}

export function clearAuth(scope: ApiScope): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(storageKey(scope));
  window.localStorage.removeItem(userStorageKey(scope));
}

function userStorageKey(scope: ApiScope): string {
  return scope === "system" ? "mn_user_system" : `mn_user_${scope.tenant}`;
}

/** Lưu thông tin user hiện tại (không nhạy cảm) để hiển thị UI ngay mà không cần gọi lại API. */
export function writeStoredUser<T>(scope: ApiScope, user: T): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(userStorageKey(scope), JSON.stringify(user));
}

export function readStoredUser<T>(scope: ApiScope): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(userStorageKey(scope));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function scopePrefix(scope: ApiScope): string {
  return scope === "system" ? "/api/v1/system" : `/api/v1/${scope.tenant}`;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Bỏ qua gắn Authorization header (vd. login). */
  skipAuth?: boolean;
  /** Bỏ qua auto-refresh khi 401 (vd. chính request refresh). */
  skipRefresh?: boolean;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const body = json as ApiErrorBody | undefined;
    throw new ApiError(
      res.status,
      body?.error?.code ?? "UNKNOWN_ERROR",
      body?.error?.message ?? `Yêu cầu thất bại (${res.status})`
    );
  }
  return json as T;
}

async function rawFetch(path: string, options: RequestOptions, accessToken?: string) {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken && !options.skipAuth) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return fetch(path, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

async function tryRefresh(scope: ApiScope): Promise<StoredAuth | null> {
  if (scope === "system") return null; // Không có endpoint refresh cho super admin.
  const current = readAuth(scope);
  if (!current?.refreshToken) return null;
  try {
    const res = await rawFetch(
      `${scopePrefix(scope)}/auth/refresh`,
      { method: "POST", body: { refresh_token: current.refreshToken }, skipRefresh: true },
      undefined
    );
    const json = await parseResponse<{
      data: { access_token: string; refresh_token?: string };
    }>(res);
    const next: StoredAuth = {
      accessToken: json.data.access_token,
      refreshToken: json.data.refresh_token ?? current.refreshToken,
    };
    writeAuth(scope, next);
    return next;
  } catch {
    clearAuth(scope);
    return null;
  }
}

/**
 * Gọi API. `path` là phần sau prefix tenant/system, vd "/students" hoặc "/auth/login".
 */
export async function apiRequest<T = unknown>(
  scope: ApiScope,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const fullPath = `${scopePrefix(scope)}${path}`;
  const auth = readAuth(scope);

  let res: Response;
  try {
    res = await rawFetch(fullPath, options, auth?.accessToken);
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.");
  }

  if (res.status === 401 && !options.skipRefresh) {
    const refreshed = await tryRefresh(scope);
    if (refreshed) {
      try {
        res = await rawFetch(fullPath, options, refreshed.accessToken);
      } catch {
        throw new ApiError(0, "NETWORK_ERROR", "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.");
      }
    }
  }

  return parseResponse<T>(res);
}

export function getAccessToken(scope: ApiScope): string | null {
  return readAuth(scope)?.accessToken ?? null;
}

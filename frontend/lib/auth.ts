/**
 * AVORA RESTAURANT - CENTRALIZED AUTHENTICATION UTILITY
 * Quản trị trạng thái phiên, token, cookie và logout an toàn đồng bộ
 */

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone?: string;
  avatarUrl?: string;
  [key: string]: any;
}

const TOKEN_KEY = 'token';
const ACCESS_TOKEN_KEY = 'access_token';
const USER_KEY = 'user';

/**
 * Lấy API base URL phù hợp:
 * - Trên trình duyệt: sử dụng relative path (rỗng '') để tự động định tuyến qua Nginx same-origin,
 *   loại bỏ hoàn toàn rủi ro CORS, preflight failure và cookie cross-origin mismatch.
 * - Trên server (SSR): fallback process.env.INTERNAL_API_URL hoặc NEXT_PUBLIC_API_URL.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '';
  }
  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:4001'
  );
}

/**
 * Đọc cookie từ document.cookie
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

/**
 * Lấy token xác thực hiện tại (ưu tiên localStorage, fallback URL param hoặc client cookie)
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token && token.trim() !== '' && token !== 'undefined' && token !== 'null') {
      return token;
    }
  } catch {}

  const cookieToken = getCookie(TOKEN_KEY);
  if (cookieToken && cookieToken.trim() !== '' && cookieToken !== 'undefined' && cookieToken !== 'null') {
    return cookieToken;
  }

  // Tự động nhận diện token từ URL search params (khi Google OAuth chuyển hướng về)
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const urlToken = searchParams.get('auth_token') || searchParams.get('token');
    if (urlToken && urlToken.trim() !== '' && urlToken !== 'undefined' && urlToken !== 'null') {
      saveAuthSession(urlToken);
      searchParams.delete('auth_token');
      searchParams.delete('token');
      const cleanUrl = `${window.location.pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', cleanUrl);
      return urlToken;
    }
  } catch {}

  return null;
}

/**
 * Lấy user profile từ localStorage
 */
export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

/**
 * Kiểm tra xem người dùng có đang đăng nhập không
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Sinh Headers kèm Bearer Authorization nếu có token
 */
export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': 'true',
    ...extraHeaders,
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Lưu phiên đăng nhập an toàn đồng bộ
 */
export function saveAuthSession(token: string, user?: AuthUser | null) {
  if (typeof window === 'undefined') return;

  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ACCESS_TOKEN_KEY, token);

      // Đặt cookie cho Client/Middleware Next.js
      const isHttps = window.location.protocol === 'https:';
      const secureFlag = isHttps ? '; Secure' : '';
      const maxAge = 7 * 24 * 60 * 60; // 7 ngày
      document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax${secureFlag}`;
    }

    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      window.dispatchEvent(new CustomEvent('user-updated', { detail: user }));
    }
  } catch (err) {
    console.error('[Auth] Failed to save auth session:', err);
  }
}

/**
 * Xóa sạch toàn bộ phiên đăng nhập ở client
 */
export function clearAuthSession() {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);

    // Xóa client cookie
    document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax;`;
    document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure;`;

    // Thông báo cho toàn bộ các listener cập nhật UI về trạng thái đăng xuất
    window.dispatchEvent(new CustomEvent('user-updated', { detail: null }));
  } catch (err) {
    console.error('[Auth] Failed to clear auth session:', err);
  }
}

/**
 * Đăng xuất người dùng toàn diện (Client + Server + Redirect)
 */
export async function logoutUser(options?: { redirectUrl?: string; reload?: boolean }) {
  const { redirectUrl = '/login', reload = true } = options || {};

  // 1. Gửi request hủy session lên backend
  try {
    const apiBase = getApiBaseUrl();
    await fetch(`${apiBase}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    }).catch(() => {});
  } catch {
    // Kể cả lỗi mạng, vẫn phải dọn sạch client
  }

  // 2. Xóa sạch dữ liệu cục bộ
  clearAuthSession();

  // 3. Chuyển hướng an toàn
  if (typeof window !== 'undefined') {
    if (reload) {
      window.location.href = redirectUrl;
    } else {
      window.location.replace(redirectUrl);
    }
  }
}

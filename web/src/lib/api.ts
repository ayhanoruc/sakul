// Thin fetch wrapper. Same-origin — the session cookie rides along automatically.

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API ${status}`);
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    // session gone → back to login (unless we're already there)
    if (!location.pathname.startsWith('/login')) {
      location.href = '/login';
    }
    throw new ApiError(401, null);
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export function apiGet<T>(url: string): Promise<T> {
  return fetch(url).then((r) => handle<T>(r));
}

export function apiSend<T>(method: string, url: string, data?: unknown): Promise<T> {
  return fetch(url, {
    method,
    headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  }).then((r) => handle<T>(r));
}

export function apiUpload<T>(url: string, form: FormData): Promise<T> {
  return fetch(url, { method: 'POST', body: form }).then((r) => handle<T>(r));
}

// ---- shared types (mirror the API's JSON) ----

export type User = { id: number; username: string; displayName: string };

export type Proje = {
  id: number;
  ad: string;
  adres: string | null;
  adaParsel: string | null;
  malSahibi: string | null;
  durum: 'aktif' | 'tamamlandi' | 'beklemede';
  baslangicTarihi: string | null;
  aciklama: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Not = {
  id: number;
  projeId: number | null;
  icerik: string;
  kaynak: 'pwa' | 'shortcut' | 'telegram';
  createdAt: string;
  updatedAt: string;
};

export type Dosya = {
  id: number;
  projeId: number | null;
  orijinalAd: string;
  saklananYol: string;
  mime: string;
  boyutByte: number;
  sha256: string;
  kategori: 'sozlesme' | 'ruhsat' | 'cek_goruntu' | 'fatura' | 'foto' | 'diger';
  aciklama: string | null;
  etiketler: string | null;
  createdAt: string;
  updatedAt: string;
  duplicate?: boolean;
};

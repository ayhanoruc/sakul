import { useEffect, useState } from 'react';
import { apiGet, apiSend } from '../lib/api';
import { enablePush, getPushState, type PushState } from '../lib/push';
import { formatDateTime } from '../lib/format';

// iCloud links for the hand-authored Shortcuts. Empty = not published yet;
// the card then shows the recipe location instead. Recipes: repo /shortcuts/*.md
const SHORTCUT_LINKS: { name: string; desc: string; url: string; recipe: string }[] = [
  {
    name: 'Şakül Not',
    desc: 'Söyle → yazıya çevrilir → nota kaydedilir. "Hey Siri, Şakül Not"',
    url: 'https://www.icloud.com/shortcuts/d519f6b6d95e4c619a3f4a5727426c94',
    recipe: 'shortcuts/sakul-not.md',
  },
  {
    name: 'Şakül Hatırlat',
    desc: 'Söyle → tarih seç → hatırlatıcı kurulur',
    url: 'https://www.icloud.com/shortcuts/0286e33697114d0cb49992d080af53f7',
    recipe: 'shortcuts/sakul-hatirlat.md',
  },
  {
    name: 'Şakül Bugün',
    desc: 'Günlük özeti tek dokunuşla açar',
    url: '',
    recipe: 'shortcuts/sakul-bugun.md',
  },
];

type TokenRow = {
  id: number;
  name: string;
  scopes: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export default function Setup() {
  const [pushState, setPushState] = useState<PushState>('unsupported');
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [newToken, setNewToken] = useState<{ name: string; token: string } | null>(null);
  const [tokenName, setTokenName] = useState('');
  const [copied, setCopied] = useState(false);

  const loadTokens = () => apiGet<TokenRow[]>('/api/device-tokens').then(setTokens);

  useEffect(() => {
    getPushState().then(setPushState);
    loadTokens();
  }, []);

  async function createToken() {
    const res = await apiSend<{ id: number; name: string; token: string }>('POST', '/api/device-tokens', {
      name: tokenName.trim() || 'iPhone',
    });
    setNewToken({ name: res.name, token: res.token });
    setTokenName('');
    await loadTokens();
  }

  async function revoke(id: number) {
    if (!confirm('Bu anahtar iptal edilsin mi? Onu kullanan kısayollar çalışmaz olur.')) return;
    await apiSend('POST', `/api/device-tokens/${id}/revoke`);
    await loadTokens();
  }

  async function copyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const stepDone = 'text-emerald-400';
  const stepTodo = 'text-slate-300';

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold">Kurulum</h2>

      {/* Step 1: install */}
      <section className="bg-slate-800 rounded-xl p-4">
        <h3 className={`text-sm font-medium ${isStandalone() ? stepDone : stepTodo}`}>
          {isStandalone() ? '✓' : '1.'} Ana ekrana ekle
        </h3>
        {isStandalone() ? (
          <p className="text-xs text-slate-500 mt-1">Uygulama ana ekrandan çalışıyor.</p>
        ) : (
          <p className="text-xs text-slate-400 mt-1">
            Safari'de <b>Paylaş (⬆︎) → Ana Ekrana Ekle</b>. Bildirimler ancak bu şekilde çalışır.
          </p>
        )}
      </section>

      {/* Step 2: push */}
      <section className="bg-slate-800 rounded-xl p-4">
        <h3 className={`text-sm font-medium ${pushState === 'on' ? stepDone : stepTodo}`}>
          {pushState === 'on' ? '✓' : '2.'} Bildirimleri aç
        </h3>
        {pushState === 'on' && <p className="text-xs text-slate-500 mt-1">Bildirimler açık.</p>}
        {pushState === 'off' && (
          <button onClick={() => enablePush().then(setPushState)} className="mt-2 bg-amber-500 text-slate-900 font-semibold rounded-xl px-4 py-2.5 text-sm">
            🔔 Bildirimleri aç
          </button>
        )}
        {pushState === 'not-installed' && (
          <p className="text-xs text-slate-400 mt-1">Önce 1. adımı tamamla.</p>
        )}
        {pushState === 'denied' && (
          <p className="text-xs text-red-300 mt-1">İzin reddedilmiş — iPhone Ayarlar → Şakül → Bildirimler'den aç.</p>
        )}
      </section>

      {/* Step 3: device token */}
      <section className="bg-slate-800 rounded-xl p-4 flex flex-col gap-2">
        <h3 className="text-sm font-medium text-slate-300">3. Kısayol anahtarı</h3>
        <p className="text-xs text-slate-400">
          Siri kısayolları bu anahtarla not/hatırlatıcı ekler. Kısayolu kurarken sorulduğunda yapıştır.
          Anahtar yalnızca <b>bir kez</b> gösterilir.
        </p>

        {newToken && (
          <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">"{newToken.name}" anahtarı — ŞİMDİ kopyala:</p>
            <code className="text-[11px] text-amber-300 break-all block">{newToken.token}</code>
            <button onClick={copyToken} className="mt-2 bg-amber-500 text-slate-900 font-semibold rounded-lg px-3 py-1.5 text-xs">
              {copied ? '✓ Kopyalandı' : '📋 Kopyala'}
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder="Cihaz adı (örn: Abi iPhone)"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400"
          />
          <button onClick={createToken} className="bg-slate-700 text-slate-200 rounded-xl px-4 text-sm">
            Oluştur
          </button>
        </div>

        {tokens.length > 0 && (
          <ul className="flex flex-col gap-1.5 mt-1">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-xs bg-slate-900/60 rounded-lg px-3 py-2">
                <span className={t.revokedAt ? 'text-slate-600 line-through' : 'text-slate-300'}>
                  {t.name}
                  <span className="text-slate-600">
                    {' '}
                    · {t.lastUsedAt ? `son: ${formatDateTime(t.lastUsedAt)}` : 'hiç kullanılmadı'}
                  </span>
                </span>
                {!t.revokedAt && (
                  <button onClick={() => revoke(t.id)} className="text-red-400/80">
                    İptal et
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Step 4: shortcuts */}
      <section className="bg-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-slate-300">4. Siri kısayolları</h3>
        <ul className="flex flex-col gap-2 mt-2">
          {SHORTCUT_LINKS.map((s) => (
            <li key={s.name} className="bg-slate-900/60 rounded-xl p-3">
              <p className="text-sm text-slate-200">🎙️ {s.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
              {s.url ? (
                <a href={s.url} className="mt-2 inline-block bg-amber-500 text-slate-900 font-semibold rounded-lg px-3 py-1.5 text-xs">
                  Kısayolu ekle
                </a>
              ) : (
                <p className="text-[11px] text-slate-500 mt-1.5">
                  iCloud linki henüz eklenmedi — tarif: <code>{s.recipe}</code>
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

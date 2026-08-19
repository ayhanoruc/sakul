import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiGet, apiSend, type Proje } from '../lib/api';
import { enablePush, getPushState, type PushState } from '../lib/push';
import { formatDateTime } from '../lib/format';

type Hatirlatici = {
  id: number;
  tur: 'sabit' | 'tekrarli' | 'turetilmis' | 'kosullu';
  baslik: string;
  detay: string | null;
  projeId: number | null;
  hatirlatmaZamani: string | null;
  tekrarKurali: string | null;
  engelleyenId: number | null;
  durum: 'bekliyor' | 'gonderildi' | 'tamamlandi' | 'iptal';
};

type Digest = { overdue: Hatirlatici[]; today: Hatirlatici[]; upcoming: Hatirlatici[]; waiting: Hatirlatici[] };

const HAFTA_GUNLERI = [
  { value: 'pzt', label: 'Pazartesi' },
  { value: 'sal', label: 'Salı' },
  { value: 'car', label: 'Çarşamba' },
  { value: 'per', label: 'Perşembe' },
  { value: 'cum', label: 'Cuma' },
  { value: 'cmt', label: 'Cumartesi' },
  { value: 'paz', label: 'Pazar' },
];

export default function Today() {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [pushState, setPushState] = useState<PushState>('unsupported');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setDigest(await apiGet<Digest>('/api/digest/today'));
  }, []);

  useEffect(() => {
    load();
    getPushState().then(setPushState);
  }, [load]);

  async function complete(id: number) {
    await apiSend('POST', `/api/hatirlaticilar/${id}/complete`);
    await load();
  }

  async function snooze(id: number, minutes: number) {
    await apiSend('POST', `/api/hatirlaticilar/${id}/snooze`, { minutes });
    await load();
  }

  const todayLabel = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400 capitalize">{todayLabel}</p>

      {pushState === 'not-installed' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
          Bildirim alabilmek için: Safari'de <b>Paylaş → Ana Ekrana Ekle</b>, sonra uygulamayı ana
          ekrandan aç.
        </div>
      )}
      {pushState === 'off' && (
        <button
          onClick={() => enablePush().then(setPushState)}
          className="bg-amber-500 text-slate-900 font-semibold rounded-xl py-3 text-sm"
        >
          🔔 Bildirimleri aç
        </button>
      )}
      {pushState === 'denied' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-200">
          Bildirim izni reddedilmiş. Ayarlar → Şakül → Bildirimler'den izin ver.
        </div>
      )}

      <button
        onClick={() => setShowForm((v) => !v)}
        className="bg-slate-800 border border-dashed border-slate-600 rounded-xl py-2.5 text-sm text-slate-300"
      >
        {showForm ? 'Vazgeç' : '＋ Yeni hatırlatıcı'}
      </button>
      {showForm && (
        <ReminderForm
          waitingCandidates={[...(digest?.today ?? []), ...(digest?.upcoming ?? []), ...(digest?.waiting ?? [])]}
          onDone={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {digest && (
        <>
          <Section title="⏰ Gecikmiş" tone="text-red-400" items={digest.overdue} onComplete={complete} onSnooze={snooze} />
          <Section title="📋 Bugün" tone="text-amber-400" items={digest.today} onComplete={complete} onSnooze={snooze} />
          <Section title="🔗 Bekleyen (koşullu)" tone="text-sky-400" items={digest.waiting} onComplete={complete} />
          <Section title="📅 Önümüzdeki 7 gün" tone="text-slate-400" items={digest.upcoming} onComplete={complete} onSnooze={snooze} />
          {digest.overdue.length + digest.today.length + digest.upcoming.length + digest.waiting.length === 0 && (
            <div className="bg-slate-800 rounded-xl p-6 text-center text-slate-400 text-sm">
              Her şey yolunda — açık hatırlatıcı yok ✅
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  tone,
  items,
  onComplete,
  onSnooze,
}: {
  title: string;
  tone: string;
  items: Hatirlatici[];
  onComplete: (id: number) => void;
  onSnooze?: (id: number, minutes: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className={`text-sm font-medium mb-2 ${tone}`}>
        {title} ({items.length})
      </h3>
      <ul className="flex flex-col gap-2">
        {items.map((r) => (
          <li key={r.id} className="bg-slate-800 rounded-xl p-3">
            <p className="text-[15px]">{r.baslik}</p>
            {r.detay && <p className="text-xs text-slate-400 mt-0.5">{r.detay}</p>}
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-slate-500">
                {r.hatirlatmaZamani ? formatDateTime(r.hatirlatmaZamani) : 'engel kalkınca'}
                {r.tur === 'tekrarli' && ' · 🔁'}
                {r.tur === 'turetilmis' && ' · otomatik'}
              </span>
              <span className="flex gap-2">
                {onSnooze && (
                  <button
                    onClick={() => onSnooze(r.id, 120)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 text-slate-300"
                  >
                    +2 saat
                  </button>
                )}
                <button
                  onClick={() => onComplete(r.id)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600/80 text-white"
                >
                  ✓ Tamam
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReminderForm({ waitingCandidates, onDone }: { waitingCandidates: Hatirlatici[]; onDone: () => void }) {
  const [tur, setTur] = useState<'sabit' | 'tekrarli' | 'kosullu'>('sabit');
  const [baslik, setBaslik] = useState('');
  const [zaman, setZaman] = useState('');
  const [kural, setKural] = useState('her_gun');
  const [haftaGunu, setHaftaGunu] = useState('pzt');
  const [ayGunu, setAyGunu] = useState('1');
  const [engelleyen, setEngelleyen] = useState('');
  const [projeId, setProjeId] = useState('');
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet<Proje[]>('/api/projeler').then(setProjeler);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        tur,
        baslik: baslik.trim(),
        projeId: projeId ? Number(projeId) : null,
      };
      if (tur !== 'kosullu') body.hatirlatmaZamani = new Date(zaman).toISOString();
      if (tur === 'tekrarli') {
        body.tekrarKurali =
          kural === 'her_gun' ? 'her_gun' : kural === 'her_hafta' ? `her_hafta:${haftaGunu}` : `her_ay:${ayGunu}`;
      }
      if (tur === 'kosullu') body.engelleyenId = Number(engelleyen);
      await apiSend('POST', '/api/hatirlaticilar', body);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const input =
    'bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-base outline-none focus:border-amber-400';
  const valid =
    baslik.trim() && (tur === 'kosullu' ? engelleyen : zaman);

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 bg-slate-800/50 rounded-xl p-3">
      <div className="flex gap-1.5">
        {(
          [
            ['sabit', 'Tek sefer'],
            ['tekrarli', 'Tekrarlı'],
            ['kosullu', 'Koşullu'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setTur(v)}
            className={`flex-1 text-xs py-2 rounded-lg border ${
              tur === v ? 'border-amber-400 text-amber-400' : 'border-slate-700 text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <input className={input} placeholder="Ne hatırlatılsın? *" value={baslik} onChange={(e) => setBaslik(e.target.value)} />

      {tur !== 'kosullu' && (
        <input type="datetime-local" className={input} value={zaman} onChange={(e) => setZaman(e.target.value)} />
      )}

      {tur === 'tekrarli' && (
        <div className="flex gap-2">
          <select className={`${input} flex-1`} value={kural} onChange={(e) => setKural(e.target.value)}>
            <option value="her_gun">Her gün</option>
            <option value="her_hafta">Her hafta</option>
            <option value="her_ay">Her ay</option>
          </select>
          {kural === 'her_hafta' && (
            <select className={`${input} flex-1`} value={haftaGunu} onChange={(e) => setHaftaGunu(e.target.value)}>
              {HAFTA_GUNLERI.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          )}
          {kural === 'her_ay' && (
            <select className={`${input} flex-1`} value={ayGunu} onChange={(e) => setAyGunu(e.target.value)}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Ayın {d}'i
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {tur === 'kosullu' && (
        <select className={input} value={engelleyen} onChange={(e) => setEngelleyen(e.target.value)}>
          <option value="">Hangisi bitince? *</option>
          {waitingCandidates.map((r) => (
            <option key={r.id} value={r.id}>
              {r.baslik}
            </option>
          ))}
        </select>
      )}

      <select className={input} value={projeId} onChange={(e) => setProjeId(e.target.value)}>
        <option value="">Proje yok</option>
        {projeler.map((p) => (
          <option key={p.id} value={p.id}>
            {p.ad}
          </option>
        ))}
      </select>

      <button disabled={busy || !valid} className="bg-amber-500 disabled:opacity-40 text-slate-900 font-semibold rounded-xl py-2.5 text-sm">
        Kaydet
      </button>
    </form>
  );
}

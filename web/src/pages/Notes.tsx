import { useEffect, useState, type FormEvent } from 'react';
import { apiGet, apiSend, type Not, type Proje } from '../lib/api';
import { formatDateTime } from '../lib/format';

const KAYNAK_ICON: Record<Not['kaynak'], string> = { pwa: '', shortcut: '🎙️', telegram: '✈️' };

export default function Notes() {
  const [notlar, setNotlar] = useState<Not[]>([]);
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [icerik, setIcerik] = useState('');
  const [projeFiltre, setProjeFiltre] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(filter = projeFiltre) {
    const url = filter ? `/api/notlar?proje=${filter}` : '/api/notlar';
    setNotlar(await apiGet<Not[]>(url));
  }

  useEffect(() => {
    load();
    apiGet<Proje[]>('/api/projeler').then(setProjeler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!icerik.trim()) return;
    setBusy(true);
    try {
      await apiSend('POST', '/api/notlar', {
        icerik: icerik.trim(),
        projeId: projeFiltre ? Number(projeFiltre) : null,
      });
      setIcerik('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function attach(not: Not, projeId: string) {
    await apiSend('PUT', `/api/notlar/${not.id}`, { projeId: projeId ? Number(projeId) : null });
    await load();
  }

  async function remove(id: number) {
    if (!confirm('Not silinsin mi?')) return;
    await apiSend('DELETE', `/api/notlar/${id}`);
    await load();
  }

  const projeAd = (id: number | null) => projeler.find((p) => p.id === id)?.ad;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex flex-col gap-2">
        <textarea
          value={icerik}
          onChange={(e) => setIcerik(e.target.value)}
          placeholder="Hızlı not… (klavyedeki 🎤 ile dikte edebilirsin)"
          rows={2}
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-base outline-none focus:border-amber-400 resize-none"
        />
        <div className="flex gap-2">
          <select
            value={projeFiltre}
            onChange={(e) => {
              setProjeFiltre(e.target.value);
              load(e.target.value);
            }}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
          >
            <option value="">Tüm projeler</option>
            {projeler.map((p) => (
              <option key={p.id} value={p.id}>
                {p.ad}
              </option>
            ))}
          </select>
          <button
            disabled={busy || !icerik.trim()}
            className="bg-amber-500 disabled:opacity-40 text-slate-900 font-semibold rounded-xl px-5 text-sm"
          >
            Ekle
          </button>
        </div>
      </form>

      <ul className="flex flex-col gap-2">
        {notlar.map((n) => (
          <li key={n.id} className="bg-slate-800 rounded-xl p-3">
            <p className="whitespace-pre-wrap text-[15px]">{n.icerik}</p>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
              <span>
                {KAYNAK_ICON[n.kaynak]} {formatDateTime(n.createdAt)}
                {n.projeId != null && projeAd(n.projeId) && (
                  <span className="ml-2 text-amber-400/80">· {projeAd(n.projeId)}</span>
                )}
              </span>
              <span className="flex gap-3">
                {n.projeId == null && projeler.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => e.target.value && attach(n, e.target.value)}
                    className="bg-slate-700 rounded px-1.5 py-0.5 text-xs max-w-28"
                  >
                    <option value="">＋ proje</option>
                    {projeler.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.ad}
                      </option>
                    ))}
                  </select>
                )}
                <button onClick={() => remove(n.id)} className="text-slate-500 active:text-red-400">
                  Sil
                </button>
              </span>
            </div>
          </li>
        ))}
        {notlar.length === 0 && <p className="text-center text-slate-500 text-sm py-8">Henüz not yok</p>}
      </ul>
    </div>
  );
}

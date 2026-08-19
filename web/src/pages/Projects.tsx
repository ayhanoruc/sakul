import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiSend, type Proje } from '../lib/api';

const DURUM_STYLE: Record<Proje['durum'], string> = {
  aktif: 'bg-emerald-500/15 text-emerald-400',
  beklemede: 'bg-amber-500/15 text-amber-400',
  tamamlandi: 'bg-slate-500/15 text-slate-400',
};
const DURUM_LABEL: Record<Proje['durum'], string> = {
  aktif: 'Aktif',
  beklemede: 'Beklemede',
  tamamlandi: 'Tamamlandı',
};

export default function Projects() {
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ad: '', adres: '', adaParsel: '', malSahibi: '' });

  const load = () => apiGet<Proje[]>('/api/projeler').then(setProjeler);
  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    await apiSend('POST', '/api/projeler', {
      ad: form.ad.trim(),
      adres: form.adres.trim() || null,
      adaParsel: form.adaParsel.trim() || null,
      malSahibi: form.malSahibi.trim() || null,
    });
    setForm({ ad: '', adres: '', adaParsel: '', malSahibi: '' });
    setShowForm(false);
    await load();
  }

  const input =
    'bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-base outline-none focus:border-amber-400';

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => setShowForm((v) => !v)}
        className="bg-slate-800 border border-dashed border-slate-600 rounded-xl py-2.5 text-sm text-slate-300"
      >
        {showForm ? 'Vazgeç' : '＋ Yeni proje'}
      </button>

      {showForm && (
        <form onSubmit={create} className="flex flex-col gap-2 bg-slate-800/50 rounded-xl p-3">
          <input className={input} placeholder="Proje adı *" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
          <input className={input} placeholder="Adres" value={form.adres} onChange={(e) => setForm({ ...form, adres: e.target.value })} />
          <input className={input} placeholder="Ada/Parsel" value={form.adaParsel} onChange={(e) => setForm({ ...form, adaParsel: e.target.value })} />
          <input className={input} placeholder="Mal sahibi" value={form.malSahibi} onChange={(e) => setForm({ ...form, malSahibi: e.target.value })} />
          <button disabled={!form.ad.trim()} className="bg-amber-500 disabled:opacity-40 text-slate-900 font-semibold rounded-xl py-2.5 text-sm">
            Kaydet
          </button>
        </form>
      )}

      <ul className="flex flex-col gap-2">
        {projeler.map((p) => (
          <li key={p.id}>
            <Link to={`/projeler/${p.id}`} className="block bg-slate-800 rounded-xl p-4 active:bg-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[15px]">{p.ad}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${DURUM_STYLE[p.durum]}`}>
                  {DURUM_LABEL[p.durum]}
                </span>
              </div>
              {(p.malSahibi || p.adres) && (
                <p className="text-xs text-slate-400 mt-1">
                  {[p.malSahibi, p.adres].filter(Boolean).join(' · ')}
                </p>
              )}
            </Link>
          </li>
        ))}
        {projeler.length === 0 && !showForm && (
          <p className="text-center text-slate-500 text-sm py-8">Henüz proje yok</p>
        )}
      </ul>
    </div>
  );
}

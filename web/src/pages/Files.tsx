import { useEffect, useRef, useState } from 'react';
import { apiGet, apiUpload, apiSend, type Dosya, type Proje } from '../lib/api';
import { formatBytes, formatDateTime } from '../lib/format';

const KATEGORILER = [
  { value: 'sozlesme', label: 'Sözleşme' },
  { value: 'ruhsat', label: 'Ruhsat' },
  { value: 'cek_goruntu', label: 'Çek görüntüsü' },
  { value: 'fatura', label: 'Fatura' },
  { value: 'foto', label: 'Fotoğraf' },
  { value: 'diger', label: 'Diğer' },
] as const;

const katLabel = (v: Dosya['kategori']) => KATEGORILER.find((k) => k.value === v)?.label ?? v;

export default function Files() {
  const [dosyalar, setDosyalar] = useState<Dosya[]>([]);
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [kategori, setKategori] = useState<string>('diger');
  const [projeId, setProjeId] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [filtre, setFiltre] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load(kat = filtre) {
    const url = kat ? `/api/dosyalar?kategori=${kat}` : '/api/dosyalar';
    setDosyalar(await apiGet<Dosya[]>(url));
  }

  useEffect(() => {
    load();
    apiGet<Proje[]>('/api/projeler').then(setProjeler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kategori', kategori);
      if (projeId) form.append('projeId', projeId);
      if (aciklama.trim()) form.append('aciklama', aciklama.trim());
      const res = await apiUpload<Dosya>('/api/dosyalar', form);
      setMsg(res.duplicate ? 'Bu dosya zaten yüklüydü' : 'Yüklendi ✓');
      fileRef.current!.value = '';
      setAciklama('');
      await load();
    } catch {
      setMsg('Yükleme başarısız — dosya türü desteklenmiyor olabilir');
    } finally {
      setBusy(false);
    }
  }

  async function remove(d: Dosya) {
    if (!confirm(`"${d.orijinalAd}" silinsin mi?`)) return;
    await apiSend('DELETE', `/api/dosyalar/${d.id}`);
    await load();
  }

  const select = 'bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm';

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800/50 rounded-xl p-3 flex flex-col gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          className="text-sm file:bg-slate-700 file:border-0 file:rounded-lg file:px-3 file:py-1.5 file:text-slate-200 file:mr-3"
        />
        <div className="flex gap-2">
          <select value={kategori} onChange={(e) => setKategori(e.target.value)} className={`${select} flex-1`}>
            {KATEGORILER.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <select value={projeId} onChange={(e) => setProjeId(e.target.value)} className={`${select} flex-1`}>
            <option value="">Proje yok</option>
            {projeler.map((p) => (
              <option key={p.id} value={p.id}>
                {p.ad}
              </option>
            ))}
          </select>
        </div>
        <input
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          placeholder="Açıklama (aramada bulunmayı kolaylaştırır)"
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400"
        />
        <button
          onClick={upload}
          disabled={busy}
          className="bg-amber-500 disabled:opacity-40 text-slate-900 font-semibold rounded-xl py-2.5 text-sm"
        >
          {busy ? 'Yükleniyor…' : 'Yükle'}
        </button>
        {msg && <p className="text-xs text-center text-slate-400">{msg}</p>}
      </div>

      <select
        value={filtre}
        onChange={(e) => {
          setFiltre(e.target.value);
          load(e.target.value);
        }}
        className={select}
      >
        <option value="">Tüm kategoriler</option>
        {KATEGORILER.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>

      <ul className="flex flex-col gap-2">
        {dosyalar.map((d) => (
          <li key={d.id} className="bg-slate-800 rounded-xl p-3">
            <a href={`/api/dosyalar/${d.id}/download`} target="_blank" rel="noreferrer" className="text-[15px] break-all">
              {d.mime.startsWith('image/') ? '🖼️' : '📄'} {d.orijinalAd}
            </a>
            {d.aciklama && <p className="text-xs text-slate-400 mt-1">{d.aciklama}</p>}
            <div className="flex items-center justify-between mt-1.5 text-xs text-slate-500">
              <span>
                {katLabel(d.kategori)} · {formatBytes(d.boyutByte)} · {formatDateTime(d.createdAt)}
              </span>
              <button onClick={() => remove(d)} className="active:text-red-400">
                Sil
              </button>
            </div>
          </li>
        ))}
        {dosyalar.length === 0 && <p className="text-center text-slate-500 text-sm py-8">Dosya yok</p>}
      </ul>
    </div>
  );
}

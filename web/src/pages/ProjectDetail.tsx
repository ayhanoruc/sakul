import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiSend, type Dosya, type Not, type Proje } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/format';

const input =
  'bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-base outline-none focus:border-amber-400';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [proje, setProje] = useState<Proje | null>(null);
  const [notlar, setNotlar] = useState<Not[]>([]);
  const [dosyalar, setDosyalar] = useState<Dosya[]>([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    apiGet<Proje>(`/api/projeler/${id}`).then(setProje);
    apiGet<Not[]>(`/api/notlar?proje=${id}`).then(setNotlar);
    apiGet<Dosya[]>(`/api/dosyalar?proje=${id}`).then(setDosyalar);
  }, [id]);

  async function setDurum(durum: Proje['durum']) {
    setProje(await apiSend<Proje>('PUT', `/api/projeler/${id}`, { durum }));
  }

  async function remove() {
    if (!confirm(`"${proje?.ad}" silinsin mi? Notlar ve dosyalar projesiz kalır.`)) return;
    await apiSend('DELETE', `/api/projeler/${id}`);
    navigate('/projeler');
  }

  if (!proje) return <p className="text-slate-500 text-sm">Yükleniyor…</p>;

  return (
    <div className="flex flex-col gap-4">
      {editing ? (
        <EditForm
          proje={proje}
          onDone={(updated) => {
            setProje(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{proje.ad}</h2>
            <button onClick={() => setEditing(true)} className="text-slate-500 active:text-amber-400 px-2" aria-label="Düzenle">
              ✏️
            </button>
          </div>
          <dl className="mt-2 text-sm text-slate-300 flex flex-col gap-1">
            {proje.malSahibi && <Row k="Mal sahibi" v={proje.malSahibi} />}
            {proje.adres && <Row k="Adres" v={proje.adres} />}
            {proje.adaParsel && <Row k="Ada/Parsel" v={proje.adaParsel} />}
            {proje.baslangicTarihi && <Row k="Başlangıç" v={formatDate(proje.baslangicTarihi)} />}
            {proje.aciklama && <Row k="Not" v={proje.aciklama} />}
          </dl>
        </div>
      )}

      <div className="flex gap-2">
        {(['aktif', 'beklemede', 'tamamlandi'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDurum(d)}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              proje.durum === d ? 'border-amber-400 text-amber-400' : 'border-slate-700 text-slate-400'
            }`}
          >
            {d === 'aktif' ? 'Aktif' : d === 'beklemede' ? 'Beklemede' : 'Tamamlandı'}
          </button>
        ))}
        <button onClick={remove} className="ml-auto text-xs px-3 py-1.5 rounded-full border border-red-900 text-red-400">
          Sil
        </button>
      </div>

      <section>
        <h3 className="text-sm font-medium text-slate-400 mb-2">Notlar ({notlar.length})</h3>
        <ul className="flex flex-col gap-2">
          {notlar.slice(0, 5).map((n) => (
            <li key={n.id} className="bg-slate-800 rounded-xl p-3 text-sm">
              <p className="whitespace-pre-wrap">{n.icerik}</p>
              <p className="text-xs text-slate-500 mt-1">{formatDateTime(n.createdAt)}</p>
            </li>
          ))}
        </ul>
        {notlar.length === 0 && <p className="text-xs text-slate-500">Bu projede not yok</p>}
      </section>

      <section>
        <h3 className="text-sm font-medium text-slate-400 mb-2">Dosyalar ({dosyalar.length})</h3>
        <ul className="flex flex-col gap-2">
          {dosyalar.map((d) => (
            <li key={d.id}>
              <a href={`/api/dosyalar/${d.id}/download`} target="_blank" rel="noreferrer" className="block bg-slate-800 rounded-xl p-3 text-sm active:bg-slate-700">
                📄 {d.orijinalAd}
              </a>
            </li>
          ))}
        </ul>
        {dosyalar.length === 0 && (
          <p className="text-xs text-slate-500">
            Bu projede dosya yok — <Link to="/arsiv" className="text-amber-400">Arşiv</Link>den yükle
          </p>
        )}
      </section>
    </div>
  );
}

function EditForm({
  proje,
  onDone,
  onCancel,
}: {
  proje: Proje;
  onDone: (p: Proje) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    ad: proje.ad,
    adres: proje.adres ?? '',
    adaParsel: proje.adaParsel ?? '',
    malSahibi: proje.malSahibi ?? '',
    baslangicTarihi: proje.baslangicTarihi ?? '',
    aciklama: proje.aciklama ?? '',
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const updated = await apiSend<Proje>('PUT', `/api/projeler/${proje.id}`, {
      ad: f.ad.trim(),
      adres: f.adres.trim() || null,
      adaParsel: f.adaParsel.trim() || null,
      malSahibi: f.malSahibi.trim() || null,
      baslangicTarihi: f.baslangicTarihi || null,
      aciklama: f.aciklama.trim() || null,
    });
    onDone(updated);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 bg-slate-800/50 rounded-xl p-3">
      <input className={input} placeholder="Proje adı *" value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} />
      <input className={input} placeholder="Adres" value={f.adres} onChange={(e) => setF({ ...f, adres: e.target.value })} />
      <div className="flex gap-2">
        <input className={`${input} flex-1`} placeholder="Ada/Parsel" value={f.adaParsel} onChange={(e) => setF({ ...f, adaParsel: e.target.value })} />
        <input type="date" className={`${input} flex-1`} value={f.baslangicTarihi} onChange={(e) => setF({ ...f, baslangicTarihi: e.target.value })} />
      </div>
      <input className={input} placeholder="Mal sahibi" value={f.malSahibi} onChange={(e) => setF({ ...f, malSahibi: e.target.value })} />
      <textarea className={`${input} resize-none`} rows={2} placeholder="Açıklama" value={f.aciklama} onChange={(e) => setF({ ...f, aciklama: e.target.value })} />
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 bg-slate-700 text-slate-300 rounded-xl py-2.5 text-sm">
          Vazgeç
        </button>
        <button disabled={!f.ad.trim()} className="flex-1 bg-amber-500 disabled:opacity-40 text-slate-900 font-semibold rounded-xl py-2.5 text-sm">
          Güncelle
        </button>
      </div>
    </form>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-slate-500 w-24 shrink-0">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

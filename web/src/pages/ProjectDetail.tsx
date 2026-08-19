import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiSend, type Dosya, type Not, type Proje } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/format';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [proje, setProje] = useState<Proje | null>(null);
  const [notlar, setNotlar] = useState<Not[]>([]);
  const [dosyalar, setDosyalar] = useState<Dosya[]>([]);

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
      <div>
        <h2 className="text-xl font-semibold">{proje.ad}</h2>
        <dl className="mt-2 text-sm text-slate-300 flex flex-col gap-1">
          {proje.malSahibi && <Row k="Mal sahibi" v={proje.malSahibi} />}
          {proje.adres && <Row k="Adres" v={proje.adres} />}
          {proje.adaParsel && <Row k="Ada/Parsel" v={proje.adaParsel} />}
          {proje.baslangicTarihi && <Row k="Başlangıç" v={formatDate(proje.baslangicTarihi)} />}
        </dl>
      </div>

      <div className="flex gap-2">
        {(['aktif', 'beklemede', 'tamamlandi'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDurum(d)}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              proje.durum === d
                ? 'border-amber-400 text-amber-400'
                : 'border-slate-700 text-slate-400'
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
            Bu projede dosya yok — <Link to="/depo" className="text-amber-400">Depo</Link>dan yükle
          </p>
        )}
      </section>
    </div>
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

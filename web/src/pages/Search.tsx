import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, type Dosya, type Not, type Proje } from '../lib/api';
import { formatDateTime } from '../lib/format';

type Results = {
  notlar: (Not & { snippet?: string })[];
  dosyalar: (Dosya & { snippet?: string })[];
  projeler: (Proje & { snippet?: string })[];
};

/** Renders the FTS snippet, honoring only our own <b> highlight tags. */
function Snippet({ html }: { html?: string }) {
  if (!html) return null;
  const parts = html.split(/(<b>|<\/b>)/);
  let bold = false;
  return (
    <p className="text-xs text-slate-400 mt-1">
      {parts.map((part, i) => {
        if (part === '<b>') {
          bold = true;
          return null;
        }
        if (part === '</b>') {
          bold = false;
          return null;
        }
        return bold ? (
          <b key={i} className="text-amber-400 font-semibold">
            {part}
          </b>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </p>
  );
}

export default function Search() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 3) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        setResults(await apiGet<Results>(`/api/search?q=${encodeURIComponent(q.trim())}`));
      } finally {
        setBusy(false);
      }
    }, 250);
  }, [q]);

  const total = results ? results.notlar.length + results.dosyalar.length + results.projeler.length : 0;

  return (
    <div className="flex flex-col gap-4">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ara… (en az 3 harf — beton, ruhsat, Mehmet…)"
        className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-base outline-none focus:border-amber-400"
      />

      {q.trim().length >= 3 && results && (
        <p className="text-xs text-slate-500">{busy ? 'Aranıyor…' : `${total} sonuç`}</p>
      )}

      {results && results.projeler.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-slate-400 mb-2">🏗️ Projeler</h3>
          <ul className="flex flex-col gap-2">
            {results.projeler.map((p) => (
              <li key={p.id}>
                <Link to={`/projeler/${p.id}`} className="block bg-slate-800 rounded-xl p-3 active:bg-slate-700">
                  <span className="text-[15px] font-medium">{p.ad}</span>
                  <Snippet html={p.snippet} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results && results.notlar.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-slate-400 mb-2">📝 Notlar</h3>
          <ul className="flex flex-col gap-2">
            {results.notlar.map((n) => (
              <li key={n.id} className="bg-slate-800 rounded-xl p-3">
                <p className="text-[15px] whitespace-pre-wrap">{n.icerik}</p>
                <p className="text-xs text-slate-500 mt-1">{formatDateTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results && results.dosyalar.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-slate-400 mb-2">📁 Arşiv</h3>
          <ul className="flex flex-col gap-2">
            {results.dosyalar.map((d) => (
              <li key={d.id}>
                <a
                  href={`/api/dosyalar/${d.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="block bg-slate-800 rounded-xl p-3 active:bg-slate-700"
                >
                  <span className="text-[15px] break-all">
                    {d.mime.startsWith('image/') ? '🖼️' : '📄'} {d.orijinalAd}
                  </span>
                  <Snippet html={d.snippet} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results && total === 0 && !busy && (
        <p className="text-center text-slate-500 text-sm py-8">"{q.trim()}" için sonuç yok</p>
      )}
      {q.trim().length > 0 && q.trim().length < 3 && (
        <p className="text-center text-slate-600 text-xs py-4">En az 3 harf yaz</p>
      )}
    </div>
  );
}

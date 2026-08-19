import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { apiGet, apiSend, apiUpload, type Dosya, type Proje } from '../lib/api';
import { formatDate, formatKurus, parseTlToKurus } from '../lib/format';

// ---------- shared bits ----------

const input =
  'bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-base outline-none focus:border-amber-400 min-w-0';
const chip = (cls: string) => `text-[11px] px-2 py-0.5 rounded-full ${cls}`;
const kurusToTl = (kurus: number | null) => (kurus == null ? '' : (kurus / 100).toString().replace('.', ','));

function useProjeler() {
  const [projeler, setProjeler] = useState<Proje[]>([]);
  useEffect(() => {
    apiGet<Proje[]>('/api/projeler').then(setProjeler);
  }, []);
  return projeler;
}

function ProjeSelect({
  value,
  onChange,
  required,
  projeler,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  projeler: Proje[];
}) {
  return (
    <select className={input} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{required ? 'Proje seç *' : 'Proje yok'}</option>
      {projeler.map((p) => (
        <option key={p.id} value={p.id}>
          {p.ad}
        </option>
      ))}
    </select>
  );
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-slate-500 active:text-amber-400 px-1.5" aria-label="Düzenle">
      ✏️
    </button>
  );
}

/** Upload a file and return its row — used by çek (photo) and belge (document) forms. */
async function uploadFile(file: File, kategori: string, projeId: number | null): Promise<Dosya> {
  const form = new FormData();
  form.append('file', file);
  form.append('kategori', kategori);
  if (projeId) form.append('projeId', String(projeId));
  return apiUpload<Dosya>('/api/dosyalar', form);
}

function FileRow({ dosyaId }: { dosyaId: number | null }) {
  if (!dosyaId) return null;
  return (
    <a
      href={`/api/dosyalar/${dosyaId}/download`}
      target="_blank"
      rel="noreferrer"
      className="mt-1.5 inline-block text-xs text-sky-400"
    >
      📎 Ekli dosyayı aç
    </a>
  );
}

// ============================================================ Çekler

type Cek = {
  id: number;
  yon: 'verilen' | 'alinan';
  karsiTaraf: string;
  tutarKurus: number;
  vadeTarihi: string;
  banka: string | null;
  cekNo: string | null;
  projeId: number | null;
  dosyaId: number | null;
  durum: 'beklemede' | 'odendi' | 'karsiliksiz' | 'iptal';
};

const CEK_DURUM: Record<Cek['durum'], [string, string]> = {
  beklemede: ['Beklemede', 'bg-amber-500/15 text-amber-400'],
  odendi: ['Ödendi', 'bg-emerald-500/15 text-emerald-400'],
  karsiliksiz: ['KARŞILIKSIZ', 'bg-red-500/20 text-red-400'],
  iptal: ['İptal', 'bg-slate-500/15 text-slate-400'],
};

function CekForm({ initial, projeler, onDone }: { initial: Cek | null; projeler: Proje[]; onDone: () => void }) {
  const [f, setF] = useState({
    yon: initial?.yon ?? 'verilen',
    karsiTaraf: initial?.karsiTaraf ?? '',
    tutar: kurusToTl(initial?.tutarKurus ?? null),
    vade: initial?.vadeTarihi ?? '',
    banka: initial?.banka ?? '',
    cekNo: initial?.cekNo ?? '',
    projeId: initial?.projeId ? String(initial.projeId) : '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const tutarKurus = parseTlToKurus(f.tutar);
    if (!tutarKurus) return;
    setBusy(true);
    try {
      const projeId = f.projeId ? Number(f.projeId) : null;
      let dosyaId = initial?.dosyaId ?? null;
      if (file) dosyaId = (await uploadFile(file, 'cek_goruntu', projeId)).id;
      const body = {
        yon: f.yon,
        karsiTaraf: f.karsiTaraf.trim(),
        tutarKurus,
        vadeTarihi: f.vade,
        banka: f.banka.trim() || null,
        cekNo: f.cekNo.trim() || null,
        projeId,
        dosyaId,
      };
      await (initial ? apiSend('PUT', `/api/cekler/${initial.id}`, body) : apiSend('POST', '/api/cekler', body));
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        {(
          [
            ['verilen', 'Verdiğimiz'],
            ['alinan', 'Aldığımız'],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setF({ ...f, yon: v })}
            className={`flex-1 text-xs py-2 rounded-lg border ${f.yon === v ? 'border-amber-400 text-amber-400' : 'border-slate-700 text-slate-400'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <input className={input} placeholder="Karşı taraf *" value={f.karsiTaraf} onChange={(e) => setF({ ...f, karsiTaraf: e.target.value })} />
      <div className="flex gap-2">
        <input className={`${input} flex-1`} inputMode="decimal" placeholder="Tutar (TL) *" value={f.tutar} onChange={(e) => setF({ ...f, tutar: e.target.value })} />
        <input type="date" className={`${input} flex-1`} value={f.vade} onChange={(e) => setF({ ...f, vade: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <input className={`${input} flex-1`} placeholder="Banka" value={f.banka} onChange={(e) => setF({ ...f, banka: e.target.value })} />
        <input className={`${input} flex-1`} placeholder="Çek no" value={f.cekNo} onChange={(e) => setF({ ...f, cekNo: e.target.value })} />
      </div>
      <ProjeSelect value={f.projeId} onChange={(v) => setF({ ...f, projeId: v })} projeler={projeler} />
      <label className="text-xs text-slate-400">
        Çek fotoğrafı {initial?.dosyaId ? '(mevcut — seçersen değişir)' : '(isteğe bağlı)'}
        <input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm file:bg-slate-700 file:border-0 file:rounded-lg file:px-3 file:py-1.5 file:text-slate-200 file:mr-3" />
      </label>
      <button disabled={busy || !f.karsiTaraf.trim() || !parseTlToKurus(f.tutar) || !f.vade} className="bg-amber-500 disabled:opacity-40 text-slate-900 font-semibold rounded-xl py-2.5 text-sm">
        {busy ? 'Kaydediliyor…' : initial ? 'Güncelle' : 'Kaydet — vade uyarıları otomatik kurulur'}
      </button>
    </form>
  );
}

function Cekler({ projeler }: { projeler: Proje[] }) {
  const [rows, setRows] = useState<Cek[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Cek | null>(null);

  const load = () => apiGet<Cek[]>('/api/cekler').then(setRows);
  useEffect(() => {
    load();
  }, []);

  async function setDurum(c: Cek, durum: Cek['durum']) {
    await apiSend('PUT', `/api/cekler/${c.id}`, { durum });
    await load();
  }

  const done = () => {
    setAdding(false);
    setEditing(null);
    load();
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => {
          setAdding(!adding);
          setEditing(null);
        }}
        className="bg-slate-800 border border-dashed border-slate-600 rounded-xl py-2.5 text-sm text-slate-300"
      >
        {adding ? 'Vazgeç' : '＋ Yeni çek'}
      </button>
      {adding && (
        <div className="bg-slate-800/50 rounded-xl p-3">
          <CekForm initial={null} projeler={projeler} onDone={done} />
        </div>
      )}

      {rows.map((c) => {
        const [label, cls] = CEK_DURUM[c.durum];
        return (
          <div key={c.id} className="bg-slate-800 rounded-xl p-3">
            {editing?.id === c.id ? (
              <CekForm initial={c} projeler={projeler} onDone={done} />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[15px]">
                    {c.yon === 'verilen' ? '↗' : '↙'} {c.karsiTaraf}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={chip(cls)}>{label}</span>
                    <EditBtn onClick={() => setEditing(c)} />
                  </span>
                </div>
                <p className="text-lg font-semibold mt-1">{formatKurus(c.tutarKurus)}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Vade: {formatDate(c.vadeTarihi)}
                  {c.banka && ` · ${c.banka}`}
                  {c.cekNo && ` · ${c.cekNo}`}
                </p>
                <FileRow dosyaId={c.dosyaId} />
                {c.durum === 'beklemede' && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setDurum(c, 'odendi')} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/80 text-white">
                      ✓ Ödendi
                    </button>
                    <button onClick={() => setDurum(c, 'karsiliksiz')} className="text-xs px-3 py-1.5 rounded-lg bg-red-600/70 text-white">
                      Karşılıksız
                    </button>
                    <button onClick={() => setDurum(c, 'iptal')} className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300">
                      İptal
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      {rows.length === 0 && <p className="text-center text-slate-500 text-sm py-6">Çek kaydı yok</p>}
    </div>
  );
}

// ============================================================ Hakedişler

type Hakedis = {
  id: number;
  projeId: number;
  taseronId: number | null;
  yon: 'gelen' | 'giden';
  aciklama: string | null;
  tutarKurus: number;
  vadeTarihi: string | null;
  odendiMi: number;
};

function HakedisForm({ initial, projeler, onDone }: { initial: Hakedis | null; projeler: Proje[]; onDone: () => void }) {
  const [f, setF] = useState({
    yon: initial?.yon ?? 'giden',
    tutar: kurusToTl(initial?.tutarKurus ?? null),
    vade: initial?.vadeTarihi ?? '',
    aciklama: initial?.aciklama ?? '',
    projeId: initial?.projeId ? String(initial.projeId) : '',
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const tutarKurus = parseTlToKurus(f.tutar);
    if (!tutarKurus || !f.projeId) return;
    const body = {
      projeId: Number(f.projeId),
      yon: f.yon,
      tutarKurus,
      vadeTarihi: f.vade || null,
      aciklama: f.aciklama.trim() || null,
    };
    await (initial ? apiSend('PUT', `/api/hakedisler/${initial.id}`, body) : apiSend('POST', '/api/hakedisler', body));
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        {(
          [
            ['giden', 'Ödeyeceğiz (taşerona)'],
            ['gelen', 'Alacağız (mal sahibinden)'],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setF({ ...f, yon: v })}
            className={`flex-1 text-xs py-2 rounded-lg border ${f.yon === v ? 'border-amber-400 text-amber-400' : 'border-slate-700 text-slate-400'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <ProjeSelect value={f.projeId} onChange={(v) => setF({ ...f, projeId: v })} required projeler={projeler} />
      <div className="flex gap-2">
        <input className={`${input} flex-1`} inputMode="decimal" placeholder="Tutar (TL) *" value={f.tutar} onChange={(e) => setF({ ...f, tutar: e.target.value })} />
        <input type="date" className={`${input} flex-1`} value={f.vade} onChange={(e) => setF({ ...f, vade: e.target.value })} />
      </div>
      <input className={input} placeholder="Açıklama (örn: kaba inşaat 2. hakediş)" value={f.aciklama} onChange={(e) => setF({ ...f, aciklama: e.target.value })} />
      <button disabled={!parseTlToKurus(f.tutar) || !f.projeId} className="bg-amber-500 disabled:opacity-40 text-slate-900 font-semibold rounded-xl py-2.5 text-sm">
        {initial ? 'Güncelle' : 'Kaydet'}
      </button>
    </form>
  );
}

function Hakedisler({ projeler }: { projeler: Proje[] }) {
  const [rows, setRows] = useState<Hakedis[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Hakedis | null>(null);

  const load = () => apiGet<Hakedis[]>('/api/hakedisler').then(setRows);
  useEffect(() => {
    load();
  }, []);

  const projeAd = (id: number) => projeler.find((p) => p.id === id)?.ad ?? `#${id}`;
  const done = () => {
    setAdding(false);
    setEditing(null);
    load();
  };

  async function markPaid(h: Hakedis) {
    await apiSend('PUT', `/api/hakedisler/${h.id}`, { odendiMi: 1 });
    await load();
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => {
          setAdding(!adding);
          setEditing(null);
        }}
        className="bg-slate-800 border border-dashed border-slate-600 rounded-xl py-2.5 text-sm text-slate-300"
      >
        {adding ? 'Vazgeç' : '＋ Yeni hakediş'}
      </button>
      {adding && (
        <div className="bg-slate-800/50 rounded-xl p-3">
          <HakedisForm initial={null} projeler={projeler} onDone={done} />
        </div>
      )}

      {rows.map((h) => (
        <div key={h.id} className="bg-slate-800 rounded-xl p-3">
          {editing?.id === h.id ? (
            <HakedisForm initial={h} projeler={projeler} onDone={done} />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[15px]">
                  {h.yon === 'giden' ? '↗ Ödeme' : '↙ Tahsilat'} · {projeAd(h.projeId)}
                </span>
                <span className="flex items-center gap-1">
                  <span className={chip(h.odendiMi ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400')}>
                    {h.odendiMi ? 'Ödendi' : 'Bekliyor'}
                  </span>
                  <EditBtn onClick={() => setEditing(h)} />
                </span>
              </div>
              <p className="text-lg font-semibold mt-1">{formatKurus(h.tutarKurus)}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {h.aciklama}
                {h.vadeTarihi && ` · vade ${formatDate(h.vadeTarihi)}`}
              </p>
              {!h.odendiMi && (
                <button onClick={() => markPaid(h)} className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-emerald-600/80 text-white">
                  ✓ Ödendi işaretle
                </button>
              )}
            </>
          )}
        </div>
      ))}
      {rows.length === 0 && <p className="text-center text-slate-500 text-sm py-6">Hakediş kaydı yok</p>}
    </div>
  );
}

// ============================================================ Belgeler

type Belge = {
  id: number;
  projeId: number;
  tur: string;
  verilisTarihi: string | null;
  gecerlilikBitis: string | null;
  dosyaId: number | null;
  aciklama: string | null;
};

const BELGE_TURLER = [
  ['ruhsat', 'Ruhsat'],
  ['temel_vizesi', 'Temel vizesi'],
  ['iskan', 'İskan'],
  ['yapi_denetim', 'Yapı denetim'],
  ['sgk', 'SGK'],
  ['sigorta', 'Sigorta'],
  ['diger', 'Diğer'],
] as const;

function BelgeForm({ initial, projeler, onDone }: { initial: Belge | null; projeler: Proje[]; onDone: () => void }) {
  const [f, setF] = useState({
    tur: initial?.tur ?? 'ruhsat',
    projeId: initial?.projeId ? String(initial.projeId) : '',
    verilis: initial?.verilisTarihi ?? '',
    bitis: initial?.gecerlilikBitis ?? '',
    aciklama: initial?.aciklama ?? '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.projeId) return;
    setBusy(true);
    try {
      const projeId = Number(f.projeId);
      let dosyaId = initial?.dosyaId ?? null;
      if (file) {
        // belge PDF/photo goes into the Arşiv with a matching category
        const kategori = f.tur === 'ruhsat' ? 'ruhsat' : 'diger';
        dosyaId = (await uploadFile(file, kategori, projeId)).id;
      }
      const body = {
        projeId,
        tur: f.tur,
        verilisTarihi: f.verilis || null,
        gecerlilikBitis: f.bitis || null,
        aciklama: f.aciklama.trim() || null,
        dosyaId,
      };
      await (initial ? apiSend('PUT', `/api/belgeler/${initial.id}`, body) : apiSend('POST', '/api/belgeler', body));
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <select className={`${input} flex-1`} value={f.tur} onChange={(e) => setF({ ...f, tur: e.target.value })}>
          {BELGE_TURLER.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <ProjeSelect value={f.projeId} onChange={(v) => setF({ ...f, projeId: v })} required projeler={projeler} />
      </div>
      <div className="flex gap-2 items-center">
        <label className="text-xs text-slate-500 w-14">Veriliş</label>
        <input type="date" className={`${input} flex-1`} value={f.verilis} onChange={(e) => setF({ ...f, verilis: e.target.value })} />
      </div>
      <div className="flex gap-2 items-center">
        <label className="text-xs text-slate-500 w-14">Bitiş</label>
        <input type="date" className={`${input} flex-1`} value={f.bitis} onChange={(e) => setF({ ...f, bitis: e.target.value })} />
      </div>
      <input className={input} placeholder="Açıklama" value={f.aciklama} onChange={(e) => setF({ ...f, aciklama: e.target.value })} />
      <label className="text-xs text-slate-400">
        Belge dosyası — PDF veya fotoğraf {initial?.dosyaId ? '(mevcut — seçersen değişir)' : '(isteğe bağlı)'}
        <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm file:bg-slate-700 file:border-0 file:rounded-lg file:px-3 file:py-1.5 file:text-slate-200 file:mr-3" />
      </label>
      <button disabled={busy || !f.projeId} className="bg-amber-500 disabled:opacity-40 text-slate-900 font-semibold rounded-xl py-2.5 text-sm">
        {busy ? 'Kaydediliyor…' : initial ? 'Güncelle' : 'Kaydet — bitiş uyarıları otomatik kurulur'}
      </button>
    </form>
  );
}

function Belgeler({ projeler }: { projeler: Proje[] }) {
  const [rows, setRows] = useState<Belge[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Belge | null>(null);

  const load = () => apiGet<Belge[]>('/api/belgeler').then(setRows);
  useEffect(() => {
    load();
  }, []);

  const turLabel = (t: string) => BELGE_TURLER.find(([v]) => v === t)?.[1] ?? t;
  const projeAd = (id: number) => projeler.find((p) => p.id === id)?.ad ?? `#${id}`;
  const done = () => {
    setAdding(false);
    setEditing(null);
    load();
  };

  function expiryTone(bitis: string | null): string {
    if (!bitis) return 'text-slate-400';
    const days = Math.floor((new Date(bitis).getTime() - Date.now()) / 86400_000);
    return days < 7 ? 'text-red-400' : days < 30 ? 'text-amber-400' : 'text-slate-400';
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => {
          setAdding(!adding);
          setEditing(null);
        }}
        className="bg-slate-800 border border-dashed border-slate-600 rounded-xl py-2.5 text-sm text-slate-300"
      >
        {adding ? 'Vazgeç' : '＋ Yeni belge'}
      </button>
      {adding && (
        <div className="bg-slate-800/50 rounded-xl p-3">
          <BelgeForm initial={null} projeler={projeler} onDone={done} />
        </div>
      )}

      {rows.map((b) => (
        <div key={b.id} className="bg-slate-800 rounded-xl p-3">
          {editing?.id === b.id ? (
            <BelgeForm initial={b} projeler={projeler} onDone={done} />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="font-medium text-[15px]">📄 {turLabel(b.tur)}</span>
                <span className="flex items-center gap-1">
                  <span className="text-xs text-slate-500">{projeAd(b.projeId)}</span>
                  <EditBtn onClick={() => setEditing(b)} />
                </span>
              </div>
              {b.aciklama && <p className="text-xs text-slate-400 mt-1">{b.aciklama}</p>}
              <p className={`text-xs mt-1 ${expiryTone(b.gecerlilikBitis)}`}>
                {b.gecerlilikBitis ? `Geçerlilik: ${formatDate(b.gecerlilikBitis)}` : 'Süresiz'}
              </p>
              <FileRow dosyaId={b.dosyaId} />
            </>
          )}
        </div>
      ))}
      {rows.length === 0 && <p className="text-center text-slate-500 text-sm py-6">Belge kaydı yok</p>}
    </div>
  );
}

// ============================================================ Malzemeler

type Malzeme = {
  id: number;
  projeId: number;
  ad: string;
  tedarikci: string | null;
  miktar: number | null;
  birim: string | null;
  siparisTarihi: string | null;
  teslimTarihi: string | null;
  teslimAlindiMi: number;
};

function MalzemeForm({ initial, projeler, onDone }: { initial: Malzeme | null; projeler: Proje[]; onDone: () => void }) {
  const [f, setF] = useState({
    ad: initial?.ad ?? '',
    tedarikci: initial?.tedarikci ?? '',
    miktar: initial?.miktar != null ? String(initial.miktar).replace('.', ',') : '',
    birim: initial?.birim ?? '',
    teslim: initial?.teslimTarihi ?? '',
    projeId: initial?.projeId ? String(initial.projeId) : '',
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.ad.trim() || !f.projeId) return;
    const body = {
      projeId: Number(f.projeId),
      ad: f.ad.trim(),
      tedarikci: f.tedarikci.trim() || null,
      miktar: f.miktar ? Number(f.miktar.replace(',', '.')) : null,
      birim: f.birim.trim() || null,
      teslimTarihi: f.teslim || null,
    };
    await (initial ? apiSend('PUT', `/api/malzemeler/${initial.id}`, body) : apiSend('POST', '/api/malzemeler', body));
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <input className={input} placeholder="Malzeme *  (örn: C30 beton)" value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} />
      <div className="flex gap-2">
        <input className={`${input} flex-1`} inputMode="decimal" placeholder="Miktar" value={f.miktar} onChange={(e) => setF({ ...f, miktar: e.target.value })} />
        <input className={`${input} w-24`} placeholder="Birim" value={f.birim} onChange={(e) => setF({ ...f, birim: e.target.value })} />
      </div>
      <input className={input} placeholder="Tedarikçi" value={f.tedarikci} onChange={(e) => setF({ ...f, tedarikci: e.target.value })} />
      <div className="flex gap-2 items-center">
        <label className="text-xs text-slate-500 w-14">Teslim</label>
        <input type="date" className={`${input} flex-1`} value={f.teslim} onChange={(e) => setF({ ...f, teslim: e.target.value })} />
      </div>
      <ProjeSelect value={f.projeId} onChange={(v) => setF({ ...f, projeId: v })} required projeler={projeler} />
      <button disabled={!f.ad.trim() || !f.projeId} className="bg-amber-500 disabled:opacity-40 text-slate-900 font-semibold rounded-xl py-2.5 text-sm">
        {initial ? 'Güncelle' : 'Kaydet'}
      </button>
    </form>
  );
}

function Malzemeler({ projeler }: { projeler: Proje[] }) {
  const [rows, setRows] = useState<Malzeme[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Malzeme | null>(null);

  const load = () => apiGet<Malzeme[]>('/api/malzemeler').then(setRows);
  useEffect(() => {
    load();
  }, []);

  const projeAd = (id: number) => projeler.find((p) => p.id === id)?.ad ?? `#${id}`;
  const done = () => {
    setAdding(false);
    setEditing(null);
    load();
  };

  async function received(m: Malzeme) {
    await apiSend('PUT', `/api/malzemeler/${m.id}`, { teslimAlindiMi: 1 });
    await load();
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => {
          setAdding(!adding);
          setEditing(null);
        }}
        className="bg-slate-800 border border-dashed border-slate-600 rounded-xl py-2.5 text-sm text-slate-300"
      >
        {adding ? 'Vazgeç' : '＋ Yeni sipariş'}
      </button>
      {adding && (
        <div className="bg-slate-800/50 rounded-xl p-3">
          <MalzemeForm initial={null} projeler={projeler} onDone={done} />
        </div>
      )}

      {rows.map((m) => (
        <div key={m.id} className="bg-slate-800 rounded-xl p-3">
          {editing?.id === m.id ? (
            <MalzemeForm initial={m} projeler={projeler} onDone={done} />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="font-medium text-[15px]">🧱 {m.ad}</span>
                <span className="flex items-center gap-1">
                  <span className={chip(m.teslimAlindiMi ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400')}>
                    {m.teslimAlindiMi ? 'Teslim alındı' : 'Bekleniyor'}
                  </span>
                  <EditBtn onClick={() => setEditing(m)} />
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {[m.miktar != null ? `${m.miktar} ${m.birim ?? ''}`.trim() : null, m.tedarikci, projeAd(m.projeId)]
                  .filter(Boolean)
                  .join(' · ')}
                {m.teslimTarihi && ` · teslim ${formatDate(m.teslimTarihi)}`}
              </p>
              {!m.teslimAlindiMi && (
                <button onClick={() => received(m)} className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-emerald-600/80 text-white">
                  ✓ Teslim alındı
                </button>
              )}
            </>
          )}
        </div>
      ))}
      {rows.length === 0 && <p className="text-center text-slate-500 text-sm py-6">Malzeme kaydı yok</p>}
    </div>
  );
}

// ============================================================ Taşeronlar

type Taseron = {
  id: number;
  ad: string;
  projeId: number | null;
  isKolu: string | null;
  telefon: string | null;
  anlasilanTutarKurus: number | null;
};

function TaseronForm({ initial, projeler, onDone }: { initial: Taseron | null; projeler: Proje[]; onDone: () => void }) {
  const [f, setF] = useState({
    ad: initial?.ad ?? '',
    isKolu: initial?.isKolu ?? '',
    telefon: initial?.telefon ?? '',
    tutar: kurusToTl(initial?.anlasilanTutarKurus ?? null),
    projeId: initial?.projeId ? String(initial.projeId) : '',
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.ad.trim()) return;
    const body = {
      ad: f.ad.trim(),
      isKolu: f.isKolu.trim() || null,
      telefon: f.telefon.trim() || null,
      anlasilanTutarKurus: f.tutar ? parseTlToKurus(f.tutar) : null,
      projeId: f.projeId ? Number(f.projeId) : null,
    };
    await (initial ? apiSend('PUT', `/api/taseronlar/${initial.id}`, body) : apiSend('POST', '/api/taseronlar', body));
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <input className={input} placeholder="Ad *" value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} />
      <div className="flex gap-2">
        <input className={`${input} flex-1`} placeholder="İş kolu (kalıp, demir…)" value={f.isKolu} onChange={(e) => setF({ ...f, isKolu: e.target.value })} />
        <input className={`${input} flex-1`} inputMode="tel" placeholder="Telefon" value={f.telefon} onChange={(e) => setF({ ...f, telefon: e.target.value })} />
      </div>
      <input className={input} inputMode="decimal" placeholder="Anlaşılan tutar (TL)" value={f.tutar} onChange={(e) => setF({ ...f, tutar: e.target.value })} />
      <ProjeSelect value={f.projeId} onChange={(v) => setF({ ...f, projeId: v })} projeler={projeler} />
      <button disabled={!f.ad.trim()} className="bg-amber-500 disabled:opacity-40 text-slate-900 font-semibold rounded-xl py-2.5 text-sm">
        {initial ? 'Güncelle' : 'Kaydet'}
      </button>
    </form>
  );
}

function Taseronlar({ projeler }: { projeler: Proje[] }) {
  const [rows, setRows] = useState<Taseron[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Taseron | null>(null);

  const load = () => apiGet<Taseron[]>('/api/taseronlar').then(setRows);
  useEffect(() => {
    load();
  }, []);

  const projeAd = (id: number | null) => (id ? (projeler.find((p) => p.id === id)?.ad ?? '') : '');
  const done = () => {
    setAdding(false);
    setEditing(null);
    load();
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => {
          setAdding(!adding);
          setEditing(null);
        }}
        className="bg-slate-800 border border-dashed border-slate-600 rounded-xl py-2.5 text-sm text-slate-300"
      >
        {adding ? 'Vazgeç' : '＋ Yeni taşeron'}
      </button>
      {adding && (
        <div className="bg-slate-800/50 rounded-xl p-3">
          <TaseronForm initial={null} projeler={projeler} onDone={done} />
        </div>
      )}

      {rows.map((t) => (
        <div key={t.id} className="bg-slate-800 rounded-xl p-3">
          {editing?.id === t.id ? (
            <TaseronForm initial={t} projeler={projeler} onDone={done} />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="font-medium text-[15px]">👷 {t.ad}</span>
                <span className="flex items-center gap-1">
                  {t.isKolu && <span className={chip('bg-sky-500/15 text-sky-400')}>{t.isKolu}</span>}
                  <EditBtn onClick={() => setEditing(t)} />
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {[t.telefon, t.anlasilanTutarKurus != null ? formatKurus(t.anlasilanTutarKurus) : null, projeAd(t.projeId)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {t.telefon && (
                <a href={`tel:${t.telefon.replace(/\s/g, '')}`} className="mt-2 inline-block text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200">
                  📞 Ara
                </a>
              )}
            </>
          )}
        </div>
      ))}
      {rows.length === 0 && <p className="text-center text-slate-500 text-sm py-6">Taşeron kaydı yok</p>}
    </div>
  );
}

// ============================================================ page

const SECTIONS = [
  ['cekler', 'Çekler'],
  ['hakedisler', 'Hakediş'],
  ['belgeler', 'Belgeler'],
  ['malzemeler', 'Malzeme'],
  ['taseronlar', 'Taşeron'],
] as const;

export default function Records() {
  const [section, setSection] = useState<(typeof SECTIONS)[number][0]>('cekler');
  const projeler = useProjeler();

  const body = useMemo(() => {
    switch (section) {
      case 'cekler':
        return <Cekler projeler={projeler} />;
      case 'hakedisler':
        return <Hakedisler projeler={projeler} />;
      case 'belgeler':
        return <Belgeler projeler={projeler} />;
      case 'malzemeler':
        return <Malzemeler projeler={projeler} />;
      case 'taseronlar':
        return <Taseronlar projeler={projeler} />;
    }
  }, [section, projeler]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
        {SECTIONS.map(([v, label]) => (
          <button
            key={v}
            onClick={() => setSection(v)}
            className={`shrink-0 text-xs px-3.5 py-2 rounded-full border ${
              section === v ? 'border-amber-400 text-amber-400 bg-amber-400/10' : 'border-slate-700 text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {body}
    </div>
  );
}

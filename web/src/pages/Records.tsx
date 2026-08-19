import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { apiGet, apiSend, type Proje } from '../lib/api';
import { formatDate, formatKurus, parseTlToKurus } from '../lib/format';

// ---------- shared bits ----------

const input =
  'bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-base outline-none focus:border-amber-400 min-w-0';

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

function AddBox({ label, open, setOpen, children }: { label: string; open: boolean; setOpen: (v: boolean) => void; children: ReactNode }) {
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="bg-slate-800 border border-dashed border-slate-600 rounded-xl py-2.5 text-sm text-slate-300 w-full"
      >
        {open ? 'Vazgeç' : label}
      </button>
      {open && <div className="bg-slate-800/50 rounded-xl p-3 mt-2">{children}</div>}
    </>
  );
}

const chip = (cls: string) => `text-[11px] px-2 py-0.5 rounded-full ${cls}`;

// ---------- Çekler ----------

type Cek = {
  id: number;
  yon: 'verilen' | 'alinan';
  karsiTaraf: string;
  tutarKurus: number;
  vadeTarihi: string;
  banka: string | null;
  cekNo: string | null;
  projeId: number | null;
  durum: 'beklemede' | 'odendi' | 'karsiliksiz' | 'iptal';
};

const CEK_DURUM: Record<Cek['durum'], [string, string]> = {
  beklemede: ['Beklemede', 'bg-amber-500/15 text-amber-400'],
  odendi: ['Ödendi', 'bg-emerald-500/15 text-emerald-400'],
  karsiliksiz: ['KARŞILIKSIZ', 'bg-red-500/20 text-red-400'],
  iptal: ['İptal', 'bg-slate-500/15 text-slate-400'],
};

function Cekler({ projeler }: { projeler: Proje[] }) {
  const [rows, setRows] = useState<Cek[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ yon: 'verilen', karsiTaraf: '', tutar: '', vade: '', banka: '', cekNo: '', projeId: '' });

  const load = () => apiGet<Cek[]>('/api/cekler').then(setRows);
  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    const tutarKurus = parseTlToKurus(f.tutar);
    if (!tutarKurus) return;
    await apiSend('POST', '/api/cekler', {
      yon: f.yon,
      karsiTaraf: f.karsiTaraf.trim(),
      tutarKurus,
      vadeTarihi: f.vade,
      banka: f.banka.trim() || null,
      cekNo: f.cekNo.trim() || null,
      projeId: f.projeId ? Number(f.projeId) : null,
    });
    setF({ yon: 'verilen', karsiTaraf: '', tutar: '', vade: '', banka: '', cekNo: '', projeId: '' });
    setOpen(false);
    await load();
  }

  async function setDurum(c: Cek, durum: Cek['durum']) {
    await apiSend('PUT', `/api/cekler/${c.id}`, { durum });
    await load();
  }

  return (
    <div className="flex flex-col gap-3">
      <AddBox label="＋ Yeni çek" open={open} setOpen={setOpen}>
        <form onSubmit={add} className="flex flex-col gap-2">
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
          <button disabled={!f.karsiTaraf.trim() || !parseTlToKurus(f.tutar) || !f.vade} className="bg-amber-500 disabled:opacity-40 text-slate-900 font-semibold rounded-xl py-2.5 text-sm">
            Kaydet — vade uyarıları otomatik kurulur
          </button>
        </form>
      </AddBox>

      {rows.map((c) => {
        const [label, cls] = CEK_DURUM[c.durum];
        return (
          <div key={c.id} className="bg-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[15px]">
                {c.yon === 'verilen' ? '↗' : '↙'} {c.karsiTaraf}
              </span>
              <span className={chip(cls)}>{label}</span>
            </div>
            <p className="text-lg font-semibold mt-1">{formatKurus(c.tutarKurus)}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Vade: {formatDate(c.vadeTarihi)}
              {c.banka && ` · ${c.banka}`}
              {c.cekNo && ` · ${c.cekNo}`}
            </p>
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
          </div>
        );
      })}
      {rows.length === 0 && <p className="text-center text-slate-500 text-sm py-6">Çek kaydı yok</p>}
    </div>
  );
}

// ---------- Hakedişler ----------

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

function Hakedisler({ projeler }: { projeler: Proje[] }) {
  const [rows, setRows] = useState<Hakedis[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ yon: 'giden', tutar: '', vade: '', aciklama: '', projeId: '' });

  const load = () => apiGet<Hakedis[]>('/api/hakedisler').then(setRows);
  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    const tutarKurus = parseTlToKurus(f.tutar);
    if (!tutarKurus || !f.projeId) return;
    await apiSend('POST', '/api/hakedisler', {
      projeId: Number(f.projeId),
      yon: f.yon,
      tutarKurus,
      vadeTarihi: f.vade || null,
      aciklama: f.aciklama.trim() || null,
    });
    setF({ yon: 'giden', tutar: '', vade: '', aciklama: '', projeId: '' });
    setOpen(false);
    await load();
  }

  async function markPaid(h: Hakedis) {
    await apiSend('PUT', `/api/hakedisler/${h.id}`, { odendiMi: 1 });
    await load();
  }

  const projeAd = (id: number) => projeler.find((p) => p.id === id)?.ad ?? `#${id}`;

  return (
    <div className="flex flex-col gap-3">
      <AddBox label="＋ Yeni hakediş" open={open} setOpen={setOpen}>
        <form onSubmit={add} className="flex flex-col gap-2">
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
            Kaydet
          </button>
        </form>
      </AddBox>

      {rows.map((h) => (
        <div key={h.id} className="bg-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[15px]">
              {h.yon === 'giden' ? '↗ Ödeme' : '↙ Tahsilat'} · {projeAd(h.projeId)}
            </span>
            <span className={chip(h.odendiMi ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400')}>
              {h.odendiMi ? 'Ödendi' : 'Bekliyor'}
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
        </div>
      ))}
      {rows.length === 0 && <p className="text-center text-slate-500 text-sm py-6">Hakediş kaydı yok</p>}
    </div>
  );
}

// ---------- Belgeler ----------

type Belge = {
  id: number;
  projeId: number;
  tur: string;
  verilisTarihi: string | null;
  gecerlilikBitis: string | null;
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

function Belgeler({ projeler }: { projeler: Proje[] }) {
  const [rows, setRows] = useState<Belge[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ tur: 'ruhsat', projeId: '', verilis: '', bitis: '', aciklama: '' });

  const load = () => apiGet<Belge[]>('/api/belgeler').then(setRows);
  useEffect(() => {
    load();
  }, []);

  const turLabel = (t: string) => BELGE_TURLER.find(([v]) => v === t)?.[1] ?? t;
  const projeAd = (id: number) => projeler.find((p) => p.id === id)?.ad ?? `#${id}`;

  function expiryTone(bitis: string | null): string {
    if (!bitis) return 'text-slate-400';
    const days = Math.floor((new Date(bitis).getTime() - Date.now()) / 86400_000);
    return days < 7 ? 'text-red-400' : days < 30 ? 'text-amber-400' : 'text-slate-400';
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!f.projeId) return;
    await apiSend('POST', '/api/belgeler', {
      projeId: Number(f.projeId),
      tur: f.tur,
      verilisTarihi: f.verilis || null,
      gecerlilikBitis: f.bitis || null,
      aciklama: f.aciklama.trim() || null,
    });
    setF({ tur: 'ruhsat', projeId: '', verilis: '', bitis: '', aciklama: '' });
    setOpen(false);
    await load();
  }

  return (
    <div className="flex flex-col gap-3">
      <AddBox label="＋ Yeni belge" open={open} setOpen={setOpen}>
        <form onSubmit={add} className="flex flex-col gap-2">
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
          <button disabled={!f.projeId} className="bg-amber-500 disabled:opacity-40 text-slate-900 font-semibold rounded-xl py-2.5 text-sm">
            Kaydet — bitiş uyarıları otomatik kurulur
          </button>
        </form>
      </AddBox>

      {rows.map((b) => (
        <div key={b.id} className="bg-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-[15px]">📄 {turLabel(b.tur)}</span>
            <span className="text-xs text-slate-500">{projeAd(b.projeId)}</span>
          </div>
          {b.aciklama && <p className="text-xs text-slate-400 mt-1">{b.aciklama}</p>}
          <p className={`text-xs mt-1 ${expiryTone(b.gecerlilikBitis)}`}>
            {b.gecerlilikBitis ? `Geçerlilik: ${formatDate(b.gecerlilikBitis)}` : 'Süresiz'}
          </p>
        </div>
      ))}
      {rows.length === 0 && <p className="text-center text-slate-500 text-sm py-6">Belge kaydı yok</p>}
    </div>
  );
}

// ---------- Malzemeler ----------

type Malzeme = {
  id: number;
  projeId: number;
  ad: string;
  tedarikci: string | null;
  miktar: number | null;
  birim: string | null;
  teslimTarihi: string | null;
  teslimAlindiMi: number;
};

function Malzemeler({ projeler }: { projeler: Proje[] }) {
  const [rows, setRows] = useState<Malzeme[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ad: '', tedarikci: '', miktar: '', birim: '', teslim: '', projeId: '' });

  const load = () => apiGet<Malzeme[]>('/api/malzemeler').then(setRows);
  useEffect(() => {
    load();
  }, []);

  const projeAd = (id: number) => projeler.find((p) => p.id === id)?.ad ?? `#${id}`;

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!f.ad.trim() || !f.projeId) return;
    await apiSend('POST', '/api/malzemeler', {
      projeId: Number(f.projeId),
      ad: f.ad.trim(),
      tedarikci: f.tedarikci.trim() || null,
      miktar: f.miktar ? Number(f.miktar.replace(',', '.')) : null,
      birim: f.birim.trim() || null,
      teslimTarihi: f.teslim || null,
    });
    setF({ ad: '', tedarikci: '', miktar: '', birim: '', teslim: '', projeId: '' });
    setOpen(false);
    await load();
  }

  async function received(m: Malzeme) {
    await apiSend('PUT', `/api/malzemeler/${m.id}`, { teslimAlindiMi: 1 });
    await load();
  }

  return (
    <div className="flex flex-col gap-3">
      <AddBox label="＋ Yeni sipariş" open={open} setOpen={setOpen}>
        <form onSubmit={add} className="flex flex-col gap-2">
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
            Kaydet
          </button>
        </form>
      </AddBox>

      {rows.map((m) => (
        <div key={m.id} className="bg-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-[15px]">🧱 {m.ad}</span>
            <span className={chip(m.teslimAlindiMi ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400')}>
              {m.teslimAlindiMi ? 'Teslim alındı' : 'Bekleniyor'}
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
        </div>
      ))}
      {rows.length === 0 && <p className="text-center text-slate-500 text-sm py-6">Malzeme kaydı yok</p>}
    </div>
  );
}

// ---------- Taşeronlar ----------

type Taseron = {
  id: number;
  ad: string;
  projeId: number | null;
  isKolu: string | null;
  telefon: string | null;
  anlasilanTutarKurus: number | null;
};

function Taseronlar({ projeler }: { projeler: Proje[] }) {
  const [rows, setRows] = useState<Taseron[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ad: '', isKolu: '', telefon: '', tutar: '', projeId: '' });

  const load = () => apiGet<Taseron[]>('/api/taseronlar').then(setRows);
  useEffect(() => {
    load();
  }, []);

  const projeAd = (id: number | null) => (id ? (projeler.find((p) => p.id === id)?.ad ?? '') : '');

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!f.ad.trim()) return;
    await apiSend('POST', '/api/taseronlar', {
      ad: f.ad.trim(),
      isKolu: f.isKolu.trim() || null,
      telefon: f.telefon.trim() || null,
      anlasilanTutarKurus: f.tutar ? parseTlToKurus(f.tutar) : null,
      projeId: f.projeId ? Number(f.projeId) : null,
    });
    setF({ ad: '', isKolu: '', telefon: '', tutar: '', projeId: '' });
    setOpen(false);
    await load();
  }

  return (
    <div className="flex flex-col gap-3">
      <AddBox label="＋ Yeni taşeron" open={open} setOpen={setOpen}>
        <form onSubmit={add} className="flex flex-col gap-2">
          <input className={input} placeholder="Ad *" value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} />
          <div className="flex gap-2">
            <input className={`${input} flex-1`} placeholder="İş kolu (kalıp, demir…)" value={f.isKolu} onChange={(e) => setF({ ...f, isKolu: e.target.value })} />
            <input className={`${input} flex-1`} inputMode="tel" placeholder="Telefon" value={f.telefon} onChange={(e) => setF({ ...f, telefon: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <input className={`${input} flex-1`} inputMode="decimal" placeholder="Anlaşılan tutar (TL)" value={f.tutar} onChange={(e) => setF({ ...f, tutar: e.target.value })} />
          </div>
          <ProjeSelect value={f.projeId} onChange={(v) => setF({ ...f, projeId: v })} projeler={projeler} />
          <button disabled={!f.ad.trim()} className="bg-amber-500 disabled:opacity-40 text-slate-900 font-semibold rounded-xl py-2.5 text-sm">
            Kaydet
          </button>
        </form>
      </AddBox>

      {rows.map((t) => (
        <div key={t.id} className="bg-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-[15px]">👷 {t.ad}</span>
            {t.isKolu && <span className={chip('bg-sky-500/15 text-sky-400')}>{t.isKolu}</span>}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {[
              t.telefon,
              t.anlasilanTutarKurus != null ? formatKurus(t.anlasilanTutarKurus) : null,
              projeAd(t.projeId),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {t.telefon && (
            <a href={`tel:${t.telefon.replace(/\s/g, '')}`} className="mt-2 inline-block text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200">
              📞 Ara
            </a>
          )}
        </div>
      ))}
      {rows.length === 0 && <p className="text-center text-slate-500 text-sm py-6">Taşeron kaydı yok</p>}
    </div>
  );
}

// ---------- page ----------

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

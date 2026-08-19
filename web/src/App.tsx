import { useEffect, useState } from 'react';

type Health = { status: string; version: string; time: string };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setError(true));
  }, []);

  return (
    <div className="min-h-dvh bg-slate-900 text-slate-100 flex flex-col">
      <header className="px-4 pt-[env(safe-area-inset-top)] bg-slate-800/60">
        <div className="py-4 flex items-center gap-3">
          <img src="/icons/icon-192.png" alt="" className="w-9 h-9 rounded-lg" />
          <h1 className="text-xl font-semibold tracking-tight">Şakül</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-3xl">📐</p>
        <p className="text-lg font-medium">Kurulum başarılı</p>
        <p className="text-sm text-slate-400">
          {error
            ? 'API’ye ulaşılamıyor'
            : health
              ? `API çalışıyor · v${health.version}`
              : 'API kontrol ediliyor…'}
        </p>
      </main>

      <footer className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-slate-500">
        Aşama 0 — iskelet
      </footer>
    </div>
  );
}

import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { apiSend } from '../lib/api';

const tabs = [
  { to: '/', label: 'Bugün', icon: '📋' },
  { to: '/notlar', label: 'Notlar', icon: '📝' },
  { to: '/projeler', label: 'Projeler', icon: '🏗️' },
  { to: '/depo', label: 'Depo', icon: '📁' },
];

export default function Layout() {
  const navigate = useNavigate();

  async function logout() {
    await apiSend('POST', '/api/auth/logout');
    navigate('/login');
  }

  return (
    <div className="min-h-dvh bg-slate-900 text-slate-100 flex flex-col">
      <header className="sticky top-0 z-10 bg-slate-800/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/icons/icon-192.png" alt="" className="w-7 h-7 rounded-md" />
            <span className="text-lg font-semibold tracking-tight">Şakül</span>
          </div>
          <button onClick={logout} className="text-xs text-slate-400 active:text-slate-200 px-2 py-1">
            Çıkış
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-24 max-w-2xl w-full mx-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-slate-800/95 backdrop-blur border-t border-slate-700 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4 max-w-2xl mx-auto">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                  isActive ? 'text-amber-400' : 'text-slate-400'
                }`
              }
            >
              <span className="text-xl leading-none">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

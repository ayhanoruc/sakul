import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiSend, ApiError } from '../lib/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiSend('POST', '/api/auth/login', { username, password });
      navigate('/');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Çok fazla deneme — bir dakika bekleyin'
          : 'Kullanıcı adı veya şifre hatalı',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
      <img src="/icons/icon-192.png" alt="" className="w-20 h-20 rounded-2xl mb-4" />
      <h1 className="text-2xl font-semibold mb-8">Şakül</h1>
      <form onSubmit={submit} className="w-full max-w-xs flex flex-col gap-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Kullanıcı adı"
          autoCapitalize="none"
          autoCorrect="off"
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-base outline-none focus:border-amber-400"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Şifre"
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-base outline-none focus:border-amber-400"
        />
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button
          disabled={busy || !username || !password}
          className="bg-amber-500 disabled:opacity-40 text-slate-900 font-semibold rounded-xl py-3 mt-2 active:bg-amber-400"
        >
          {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
    </div>
  );
}

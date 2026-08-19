import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Today from './pages/Today';
import Notes from './pages/Notes';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Files from './pages/Files';
import { apiGet, type User } from './lib/api';

function Guard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking');

  useEffect(() => {
    apiGet<User>('/api/auth/me')
      .then(() => setState('in'))
      .catch(() => setState('out'));
  }, []);

  if (state === 'checking') {
    return <div className="min-h-dvh bg-slate-900 flex items-center justify-center text-slate-500">Şakül</div>;
  }
  if (state === 'out') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <Guard>
              <Layout />
            </Guard>
          }
        >
          <Route path="/" element={<Today />} />
          <Route path="/notlar" element={<Notes />} />
          <Route path="/projeler" element={<Projects />} />
          <Route path="/projeler/:id" element={<ProjectDetail />} />
          <Route path="/depo" element={<Files />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

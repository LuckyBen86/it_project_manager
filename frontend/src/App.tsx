import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store.ts';
import Layout from './components/Layout.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import AdminRoute from './components/AdminRoute.tsx';
import LoginPage from './pages/LoginPage.tsx';
import KanbanPage from './pages/KanbanPage.tsx';
import GanttPage from './pages/GanttPage.tsx';
import MesTachesPage from './pages/MesTachesPage.tsx';
import SynthesePage from './pages/SynthesePage.tsx';
import MesDemandesPage from './pages/MesDemandesPage.tsx';
import DemandesResponsablePage from './pages/DemandesResponsablePage.tsx';
import AdminPage from './pages/AdminPage.tsx';
import CorbeillePage from './pages/CorbeillePage.tsx';

export default function App() {
  const initFromStorage = useAuthStore((s) => s.initFromStorage);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<KanbanPage />} />
        <Route path="gantt" element={<GanttPage />} />
        <Route path="synthese" element={<SynthesePage />} />
        <Route path="mes-taches" element={<MesTachesPage />} />
        <Route path="mes-demandes" element={<MesDemandesPage />} />
        <Route path="demandes" element={<DemandesResponsablePage />} />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route
          path="corbeille"
          element={
            <AdminRoute>
              <CorbeillePage />
            </AdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

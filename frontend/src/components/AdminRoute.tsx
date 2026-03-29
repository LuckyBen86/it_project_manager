import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store.ts';

interface Props {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: Props) {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== 'responsable') return <Navigate to="/" replace />;
  return <>{children}</>;
}

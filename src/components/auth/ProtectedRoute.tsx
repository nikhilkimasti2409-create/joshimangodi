import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import type { ReactNode } from 'react';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center text-primary animate-spin mb-4">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
        </div>
        <p className="text-sm font-medium text-ink-muted">Authenticating...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

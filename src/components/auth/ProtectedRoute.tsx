import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import type { ReactNode } from 'react';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF9FA] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#FBCFE8] border border-[#E5B6D3] flex items-center justify-center text-[#9F1239] animate-spin mb-4">
          <div className="w-6 h-6 border-3 border-[#9F1239] border-t-transparent rounded-full" />
        </div>
        <p className="text-sm font-bold text-[#632055]">Authenticating with Security Shield...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

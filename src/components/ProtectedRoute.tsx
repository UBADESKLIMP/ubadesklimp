import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStaffAccess, StaffPermission } from '@/hooks/useStaffAccess';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireStaff?: boolean;
  requirePermission?: StaffPermission;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  requireStaff = false,
  requirePermission,
}) => {
  const { user, loading: authLoading } = useAuth();
  const needsStaffCheck = requireAdmin || requireStaff || !!requirePermission;
  const staffAccess = useStaffAccess();

  const stillChecking = authLoading || (needsStaffCheck && !!user && staffAccess.loading);

  if (stillChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Cada prop exigida precisa ser satisfeita (AND), não basta satisfazer
  // qualquer uma delas — um admin sempre passa, mas combinar por exemplo
  // requireAdmin + requirePermission não deve liberar acesso pra um
  // funcionário não-admin só porque ele tem a permissão.
  const hasAccess =
    !needsStaffCheck ||
    staffAccess.isAdmin ||
    (!requireAdmin &&
      (!requireStaff || staffAccess.isStaff) &&
      (requirePermission === undefined || staffAccess.permissions.has(requirePermission)));

  if (needsStaffCheck && !hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center text-white max-w-md">
          <h1 className="text-2xl font-bold mb-4">Acesso Negado</h1>
          <p className="mb-6">Você não tem permissão para acessar esta página.</p>
          <a
            href="/"
            className="inline-flex items-center px-6 py-3 bg-white text-primary rounded-lg hover:bg-white/90 transition-colors"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
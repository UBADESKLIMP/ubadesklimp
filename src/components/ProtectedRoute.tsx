import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false 
}) => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(requireAdmin);

  const auth = useAuth();

  useEffect(() => {
    if (requireAdmin && user) {
      const checkAdminStatus = async () => {
        try {
          const adminStatus = await auth.isAdmin();
          setIsAdmin(adminStatus);
        } catch (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        } finally {
          setAdminCheckLoading(false);
        }
      };

      checkAdminStatus();
    } else if (!requireAdmin) {
      setAdminCheckLoading(false);
    }
  }, [user, requireAdmin, auth]);

  // Still loading auth state
  if (authLoading || adminCheckLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Requires admin but user is not admin
  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center text-white max-w-md">
          <h1 className="text-2xl font-bold mb-4">Acesso Negado</h1>
          <p className="mb-6">Você precisa ser administrador para acessar esta página.</p>
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
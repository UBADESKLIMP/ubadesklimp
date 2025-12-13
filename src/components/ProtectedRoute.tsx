import { useEffect, useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

// Cache de status admin
const adminStatusCache = new Map<string, { value: boolean; timestamp: number }>();
const CACHE_DURATION = 60 * 1000; // 1 minuto (reduzido para revogação mais rápida de privilégios)

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false 
}) => {
  const { user, loading: authLoading, isAdmin: checkIsAdmin } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(requireAdmin);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (requireAdmin && user) {
      const checkAdminStatus = async () => {
        try {
          // Verificar cache primeiro
          const cached = adminStatusCache.get(user.id);
          if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            if (isMounted.current) {
              setIsAdmin(cached.value);
              setAdminCheckLoading(false);
            }
            return;
          }
          
          // Se não tem cache, fazer chamada
          const adminStatus = await checkIsAdmin();
          
          // Salvar no cache
          adminStatusCache.set(user.id, {
            value: adminStatus,
            timestamp: Date.now()
          });
          
          if (isMounted.current) {
            setIsAdmin(adminStatus);
          }
        } catch (error) {
          if (isMounted.current) {
            setIsAdmin(false);
          }
        } finally {
          if (isMounted.current) {
            setAdminCheckLoading(false);
          }
        }
      };

      checkAdminStatus();
    } else if (!requireAdmin) {
      setAdminCheckLoading(false);
    }
  }, [user, requireAdmin, checkIsAdmin]);

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
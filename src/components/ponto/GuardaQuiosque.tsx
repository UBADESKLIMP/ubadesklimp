import { Navigate, useLocation } from 'react-router-dom';
import { lerTokenEstacao, quiosqueLiberado, quiosqueTravado } from '@/hooks/usePontoQuiosque';

/**
 * P34: no PC registrado como estação, o resto do site não carrega — qualquer
 * rota cai na tela de bater ponto.
 *
 * A saída é o PIN de manutenção, que libera este navegador até ele fechar.
 * Por isso a trava só vale quando a empresa já definiu esse PIN: sem ele, isso
 * seria uma armadilha — quem registrasse o próprio computador perderia o
 * painel nele sem ter como voltar.
 */
const GuardaQuiosque = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();

  const eQuiosque = Boolean(lerTokenEstacao()) && quiosqueTravado() && !quiosqueLiberado();
  // /ponto/q/<token> é a tela do QR: também é ponto, não é "o resto do admin".
  if (eQuiosque && !pathname.startsWith('/ponto')) {
    return <Navigate to="/ponto" replace />;
  }

  return <>{children}</>;
};

export default GuardaQuiosque;

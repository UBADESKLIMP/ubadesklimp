import type { LucideIcon } from 'lucide-react';
import { DollarSign, ClipboardList, ChevronRight, Truck, ClipboardCheck } from 'lucide-react';
import { StaffAccess } from '@/hooks/useStaffAccess';
import AdminPageHeader from './AdminPageHeader';
import AdminComingSoon from './AdminComingSoon';
import AdminLoadingState from './AdminLoadingState';
import ProductsHomeSummary from './ProductsHomeSummary';
import { AdminSection } from './adminNav';

interface AdminHomeProps {
  staffAccess: StaffAccess;
  onNavigate: (section: AdminSection) => void;
}

interface ShortcutCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}

const ShortcutCard = ({ icon: Icon, title, description, onClick }: ShortcutCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-4 p-4 rounded-xl bg-[#12121a] border border-blue-500/20 hover:border-blue-500/40 hover:bg-[#16161f] transition-colors text-left"
  >
    <div className="p-2.5 bg-blue-600/20 rounded-xl border border-blue-500/20 text-blue-400 shrink-0">
      <Icon className="h-5 w-5" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-white">{title}</p>
      <p className="text-sm text-blue-300/50">{description}</p>
    </div>
    <ChevronRight className="h-4 w-4 text-blue-300/40 shrink-0" />
  </button>
);

const AdminHome = ({ staffAccess, onNavigate }: AdminHomeProps) => {
  const showFinanceiro = staffAccess.isAdmin || staffAccess.permissions.has('financeiro');
  const showProdutos = staffAccess.isAdmin || staffAccess.permissions.has('produtos');
  const showFornecedores = staffAccess.isAdmin || staffAccess.permissions.has('fornecedores');
  const showFaltantes = staffAccess.isAdmin || staffAccess.permissions.has('faltantes');
  const hasNothing = !showFinanceiro && !showProdutos && !showFornecedores && !showFaltantes;

  if (staffAccess.loading) {
    return (
      <div>
        <AdminPageHeader title="Início" description="Visão geral do que você pode fazer por aqui." />
        <AdminLoadingState rows={2} />
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader title="Início" description="Visão geral do que você pode fazer por aqui." />

      {hasNothing ? (
        <AdminComingSoon
          title="Ainda sem seções liberadas"
          description="Sua conta ainda não tem nenhuma seção com conteúdo pronto. Peça para um administrador liberar alguma permissão pra você."
        />
      ) : (
        <div className="space-y-8">
          {showFinanceiro && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ShortcutCard
                icon={DollarSign}
                title="Financeiro"
                description="Vendas, faturamento e comparativos"
                onClick={() => onNavigate('financeiro')}
              />
              <ShortcutCard
                icon={ClipboardList}
                title="Pedidos"
                description="Acompanhe e atualize o status dos pedidos"
                onClick={() => onNavigate('orders')}
              />
            </div>
          )}

          {showProdutos && <ProductsHomeSummary onNavigate={onNavigate} />}

          {showFornecedores && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ShortcutCard
                icon={Truck}
                title="Fornecedores"
                description="Cadastre fornecedores e abra o WhatsApp deles"
                onClick={() => onNavigate('suppliers')}
              />
            </div>
          )}

          {showFaltantes && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ShortcutCard
                icon={ClipboardCheck}
                title="Faltantes"
                description="Veja e registre produtos que estão acabando"
                onClick={() => onNavigate('missing')}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminHome;

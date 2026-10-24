import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { StaffAccess } from '@/hooks/useStaffAccess';
import { useCurrentStaffName } from '@/hooks/useCurrentStaffName';
import { useAdminHomeSummary } from '@/hooks/useAdminHomeSummary';
import { cn } from '@/lib/utils';
import AdminComingSoon from './AdminComingSoon';
import AdminLoadingState from './AdminLoadingState';
import { AdminNavItem, AdminSection } from './adminNav';

interface AdminHomeProps {
  staffAccess: StaffAccess;
  /** Itens de menu que esta pessoa pode ver; é daqui que saem os atalhos. */
  visibleItems: AdminNavItem[];
  onNavigate: (section: AdminSection) => void;
}

// Texto de cada atalho. Quem não aparece aqui não vira atalho na tela Início.
const SHORTCUTS: Partial<Record<AdminSection, { title: string; description: string }>> = {
  missing: { title: 'Faltantes', description: 'Veja e registre o que está acabando' },
  quotes: { title: 'Cotações', description: 'Peça preço aos fornecedores e compre' },
  suppliers: { title: 'Fornecedores', description: 'Cadastre e fale com os fornecedores' },
  products: { title: 'Produtos', description: 'Cadastro, preços e fotos' },
  financeiro: { title: 'Financeiro', description: 'Vendas e faturamento' },
  orders: { title: 'Pedidos do site', description: 'Acompanhe os pedidos feitos no site' },
  entregas: { title: 'Entregas', description: 'Rota do dia e entregas' },
  ponto: { title: 'Ponto', description: 'Registros de entrada e saída' },
  equipe: { title: 'Atrasos', description: 'Atrasos e justificativas da equipe' },
  'meus-registros': { title: 'Meus registros', description: 'Seus pontos e justificativas' },
};

// Versão para quem só avisa faltante: o texto fala do que a pessoa faz, não
// do nome técnico do módulo.
const SIMPLE_SHORTCUTS: Partial<Record<AdminSection, { title: string; description: string }>> = {
  ...SHORTCUTS,
  missing: { title: 'Avisar que acabou um produto', description: 'Procure o produto e diga quantos sobraram' },
};

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const today = () =>
  new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

interface ShortcutProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  large?: boolean;
}

const Shortcut = ({ icon: Icon, title, description, onClick, large }: ShortcutProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'group flex items-center gap-4 rounded-xl border border-[#DCDFD8] bg-white text-left shadow-sm',
      'transition hover:border-[#0F6B5C]/50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6B5C]',
      large ? 'p-6 min-h-[112px]' : 'p-4'
    )}
  >
    <div
      className={cn(
        'shrink-0 rounded-xl bg-[#0F6B5C]/10 text-[#0F6B5C] flex items-center justify-center',
        large ? 'h-14 w-14' : 'h-11 w-11'
      )}
    >
      <Icon className={large ? 'h-7 w-7' : 'h-5 w-5'} />
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn('font-semibold text-[#141B1E]', large ? 'text-lg' : 'text-base')}>{title}</p>
      <p className="text-sm text-[#55605F]">{description}</p>
    </div>
    <ChevronRight className="h-5 w-5 text-[#8A9290] shrink-0 transition-transform group-hover:translate-x-0.5" />
  </button>
);

interface NumberCardProps {
  label: string;
  value: number;
  hint: string;
  tone?: 'alert' | 'normal';
  onClick: () => void;
}

const NumberCard = ({ label, value, hint, tone = 'normal', onClick }: NumberCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-xl border border-[#DCDFD8] bg-white p-5 text-left shadow-sm transition hover:border-[#0F6B5C]/50 hover:shadow-md"
  >
    <p className="text-sm font-medium text-[#55605F]">{label}</p>
    <p
      className={cn(
        'mt-1 font-mono text-4xl font-semibold tabular-nums',
        tone === 'alert' && value > 0 ? 'text-[#C0392B]' : 'text-[#141B1E]'
      )}
    >
      {value}
    </p>
    <p className="mt-1 text-xs text-[#8A9290]">{hint}</p>
  </button>
);

const AdminHome = ({ staffAccess, visibleItems, onNavigate }: AdminHomeProps) => {
  const { displayName } = useCurrentStaffName();
  const keys = new Set(visibleItems.map((item) => item.key));
  const iconOf = new Map(visibleItems.map((item) => [item.key, item.icon]));

  // "Simples": quem só avisa faltante e não mexe com compra, dinheiro ou
  // cadastro. Vê só botões grandes do que pode fazer.
  const isSimple =
    !staffAccess.isAdmin &&
    !staffAccess.permissions.has('financeiro') &&
    !staffAccess.permissions.has('produtos') &&
    !staffAccess.permissions.has('fornecedores');

  const summary = useAdminHomeSummary({
    faltantes: !isSimple && keys.has('missing'),
    cotacoes: !isSimple && keys.has('quotes'),
    pedidos: !isSimple && keys.has('orders'),
    entregas: !isSimple && keys.has('entregas'),
  });

  const firstName = displayName?.split(' ')[0];
  const header = (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold text-[#141B1E]">
        {greeting()}
        {firstName ? `, ${firstName}` : ''}
      </h2>
      <p className="text-sm text-[#55605F] first-letter:uppercase">{today()}</p>
    </div>
  );

  if (staffAccess.loading) {
    return (
      <div>
        {header}
        <AdminLoadingState rows={2} tone="light" />
      </div>
    );
  }

  const shortcutKeys = (isSimple ? SIMPLE_SHORTCUTS : SHORTCUTS) as typeof SHORTCUTS;
  const shortcuts = visibleItems.filter((item) => item.key !== 'home' && shortcutKeys[item.key]);

  if (shortcuts.length === 0) {
    return (
      <div>
        {header}
        <AdminComingSoon
          title="Ainda sem seções liberadas"
          description="Sua conta ainda não tem nenhuma seção com conteúdo pronto. Peça para um administrador liberar alguma permissão pra você."
        />
      </div>
    );
  }

  const numbers: NumberCardProps[] = [];
  if (summary.faltandoAgora !== null) {
    numbers.push({
      label: 'Faltando agora',
      value: summary.faltandoAgora,
      hint:
        summary.avisadosVariasVezes && summary.avisadosVariasVezes > 0
          ? `${summary.avisadosVariasVezes} foram avisados mais de uma vez`
          : 'Produtos esperando compra',
      tone: 'alert',
      onClick: () => onNavigate('missing'),
    });
  }
  if (summary.cotacoesAbertas !== null) {
    numbers.push({
      label: 'Cotações abertas',
      value: summary.cotacoesAbertas,
      hint: 'Esperando preço ou compra',
      onClick: () => onNavigate('quotes'),
    });
  }
  if (summary.pedidosNovos !== null) {
    numbers.push({
      label: 'Pedidos novos do site',
      value: summary.pedidosNovos,
      hint: 'Ainda não atendidos',
      onClick: () => onNavigate('orders'),
    });
  }
  if (summary.entregasNaFila !== null) {
    numbers.push({
      label: 'Entregas na fila',
      value: summary.entregasNaFila,
      hint: 'Na fila ou em rota',
      onClick: () => onNavigate('entregas'),
    });
  }

  return (
    <div>
      {header}

      {!isSimple && numbers.length > 0 && (
        <section className="mb-8">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#55605F]">O que fazer hoje</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {numbers.map((card) => (
              <NumberCard key={card.label} {...card} />
            ))}
          </div>
        </section>
      )}

      <section>
        {!isSimple && (
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#55605F]">Ir para</h3>
        )}
        <div className={cn('grid gap-4', isSimple ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3')}>
          {shortcuts.map((item) => {
            const text = shortcutKeys[item.key]!;
            return (
              <Shortcut
                key={item.key}
                icon={iconOf.get(item.key) ?? item.icon}
                title={text.title}
                description={text.description}
                large={isSimple}
                onClick={() => onNavigate(item.key)}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default AdminHome;

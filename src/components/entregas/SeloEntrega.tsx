import { cn } from '@/lib/utils';
import type { EntregaSituacao } from '@/hooks/useEntregas';

// Mesmo selo do módulo Equipe (ver EquipeStatusBadge): caixa alta, cor sólida,
// leve rotação. É o elemento de assinatura do sistema — lembra que o dado
// nasceu numa lista de papel.
const SELO_BASE =
  'inline-flex items-center rounded-[3px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ' +
  'border-2 -rotate-[1.5deg] select-none whitespace-nowrap';

const SITUACAO_LABEL: Record<EntregaSituacao, string> = {
  na_fila: 'na fila',
  em_rota: 'em rota',
  entregue: 'entregue',
  nao_entregue: 'não entregue',
  cancelada: 'cancelada',
};

// Cores do CLAUDE.md: #C0392B urgente, #2F9E44 feito, #6B7280 neutro.
const SITUACAO_TOM: Record<EntregaSituacao, string> = {
  na_fila: 'text-[#6B7280] border-[#6B7280]/70 bg-[#6B7280]/10',
  em_rota: 'text-[#f0b429] border-[#f0b429]/70 bg-[#f0b429]/10',
  entregue: 'text-white border-[#2F9E44] bg-[#2F9E44]',
  nao_entregue: 'text-white border-[#C0392B] bg-[#C0392B]',
  cancelada: 'text-[#6B7280] border-[#6B7280]/60 bg-transparent line-through',
};

export const SeloEntrega = ({
  situacao,
  className,
}: {
  situacao: EntregaSituacao;
  className?: string;
}) => (
  <span className={cn(SELO_BASE, SITUACAO_TOM[situacao], className)}>
    {SITUACAO_LABEL[situacao]}
  </span>
);

/**
 * A contagem de tentativas. Da terceira em diante o selo fica sólido: não é
 * mais azar, é sinal de endereço errado ou cliente que sumiu — e aí mandar o
 * carro de novo é jogar diesel fora. Alguém precisa ligar.
 */
export const SeloTentativa = ({ tentativas }: { tentativas: number }) => {
  if (tentativas < 1) return null;
  const insistindo = tentativas >= 3;
  return (
    <span
      className={cn(
        SELO_BASE,
        'rotate-[1deg]',
        insistindo
          ? 'text-white border-[#C0392B] bg-[#C0392B]'
          : 'text-[#f0b429] border-[#f0b429]/70 bg-[#f0b429]/10'
      )}
    >
      {tentativas}ª tentativa
    </span>
  );
};

export { SELO_BASE, SITUACAO_LABEL };

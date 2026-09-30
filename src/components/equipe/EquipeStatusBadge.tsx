import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type AtrasoStatus = Database['public']['Enums']['equipe_atraso_status'];
type MedidaTipo = Database['public']['Enums']['equipe_medida_tipo'];

// Selo/carimbo: caixa alta, cor sólida forte, leve rotação. É o elemento de
// assinatura do sistema (lista de papel -> dado digital), definido no CLAUDE.md.
const SELO_BASE =
  'inline-flex items-center rounded-[3px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ' +
  'border-2 -rotate-[1.5deg] select-none whitespace-nowrap';

const ATRASO_LABEL: Record<AtrasoStatus, string> = {
  pendente_ciencia: 'aguardando ciência',
  ciente: 'ciente',
  sem_ciencia: 'sem ciência',
  justificativa_pendente: 'justificando',
  abonado: 'abonado',
  compensado: 'compensado',
  substituido: 'substituído',
};

// Cores do CLAUDE.md: Urgente #C0392B, Comprado #2F9E44, Pendente #6B7280.
const ATRASO_TOM: Record<AtrasoStatus, string> = {
  pendente_ciencia: 'text-[#f0b429] border-[#f0b429]/70 bg-[#f0b429]/10',
  ciente: 'text-[#2F9E44] border-[#2F9E44]/70 bg-[#2F9E44]/10',
  sem_ciencia: 'text-[#C0392B] border-[#C0392B]/70 bg-[#C0392B]/10',
  justificativa_pendente: 'text-[#f0b429] border-[#f0b429]/70 bg-[#f0b429]/10',
  abonado: 'text-[#6B7280] border-[#6B7280]/70 bg-[#6B7280]/10 line-through',
  compensado: 'text-[#0F6B5C] border-[#0F6B5C]/80 bg-[#0F6B5C]/15',
  substituido: 'text-[#6B7280] border-[#6B7280]/60 bg-transparent line-through',
};

export const EquipeStatusBadge = ({
  status,
  className,
}: {
  status: AtrasoStatus;
  className?: string;
}) => (
  <span className={cn(SELO_BASE, ATRASO_TOM[status], className)}>{ATRASO_LABEL[status]}</span>
);

const MEDIDA_LABEL: Record<MedidaTipo, string> = {
  orientacao_verbal: 'advertência verbal',
  orientacao_verbal_coletiva: 'orientação coletiva',
  advertencia_escrita: 'advertência escrita',
  suspensao: 'suspensão',
};

const MEDIDA_TOM: Record<MedidaTipo, string> = {
  orientacao_verbal: 'text-[#f0b429] border-[#f0b429]/70 bg-[#f0b429]/10',
  orientacao_verbal_coletiva: 'text-[#6B7280] border-[#6B7280]/70 bg-[#6B7280]/10',
  advertencia_escrita: 'text-[#C0392B] border-[#C0392B]/70 bg-[#C0392B]/10',
  suspensao: 'text-white border-[#C0392B] bg-[#C0392B]',
};

export const EquipeMedidaBadge = ({
  tipo,
  className,
}: {
  tipo: MedidaTipo;
  className?: string;
}) => <span className={cn(SELO_BASE, MEDIDA_TOM[tipo], className)}>{MEDIDA_LABEL[tipo]}</span>;

/** Minutos de atraso em monoespaçada — números são dado, não texto corrido. */
export const MinutosAtraso = ({
  minutos,
  dentroTolerancia,
}: {
  minutos: number | null;
  dentroTolerancia: boolean | null;
}) => {
  if (dentroTolerancia) {
    return <span className="font-mono text-sm text-[#2F9E44]">na tolerância</span>;
  }
  return (
    <span className="font-mono text-sm font-semibold tabular-nums text-[#C0392B]">
      {minutos ?? 0} min
    </span>
  );
};

export { ATRASO_LABEL, MEDIDA_LABEL };

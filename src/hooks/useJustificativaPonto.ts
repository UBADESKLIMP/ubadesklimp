import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database, Json } from '@/integrations/supabase/types';

export type JustificativaTipo = Database['public']['Enums']['equipe_justificativa_tipo'];
export type JustificativaStatus = Database['public']['Enums']['equipe_justificativa_status'];
export type MarcacaoPonto = Database['public']['Enums']['equipe_marcacao_ponto'];

export interface Marcacao {
  marcacao: MarcacaoPonto;
  horario: string;
}

export interface JustificativaPonto {
  id: string;
  colaborador_id: string;
  empresa_id: string;
  data: string;
  tipo: JustificativaTipo;
  motivo: string;
  status: JustificativaStatus;
  intervalo_calculado_min: number | null;
  minutos_compensados: number | null;
  minutos_suprimidos: number | null;
  valor_pago: number | null;
  motivo_rejeicao: string | null;
  atraso_id: string | null;
  /** Batida de ponto que está sendo contestada ou corrigida (Etapa 3). */
  marcacao_id: string | null;
  created_at: string;
}

// Escrito como o funcionário fala, não como o sistema guarda.
export const TIPO_LABEL: Record<JustificativaTipo, string> = {
  atraso: 'Cheguei atrasado',
  esquecimento: 'Esqueci de bater',
  marcacao_incorreta: 'Bati errado',
  marcacao_duplicada: 'Bati duas vezes',
  falha_sistema: 'O ponto não funcionou',
  servico_externo: 'Saí a serviço',
  consulta_atestado: 'Consulta médica',
  troca_turno_autorizada: 'Troquei de turno',
  compensacao_atraso: 'Compensar atraso',
  intervalo_reduzido_empresa: 'Almoço reduzido (pedido da empresa)',
};

export const MARCACAO_LABEL: Record<MarcacaoPonto, string> = {
  entrada: 'Entrada',
  saida_almoco: 'Saída para o almoço',
  retorno_almoco: 'Retorno do almoço',
  saida: 'Saída',
  hora_extra_inicio: 'Início da hora extra',
  hora_extra_saida: 'Fim da hora extra',
  saida_intermediaria: 'Saída intermediária',
  retorno_intermediario: 'Retorno intermediário',
};

export const STATUS_LABEL: Record<JustificativaStatus, string> = {
  pendente: 'aguardando gestor',
  aprovada: 'aprovada',
  rejeitada: 'rejeitada',
  aguardando_ciencia: 'aguardando sua ciência',
  concluida: 'concluída',
  substituida: 'substituída',
};

/**
 * O que o funcionário pode reportar, na ordem do que mais acontece.
 * Intervalo reduzido fica de fora: é pedido da empresa, só o gestor lança.
 */
export const TIPOS_DO_COLABORADOR: JustificativaTipo[] = [
  'atraso',
  'esquecimento',
  'marcacao_incorreta',
  'marcacao_duplicada',
  'falha_sistema',
  'servico_externo',
  'consulta_atestado',
  'troca_turno_autorizada',
  'compensacao_atraso',
];

export const useJustificativasPonto = (empresaIds: string[], apenasMinhas = false) => {
  const { toast } = useToast();
  const [justificativas, setJustificativas] = useState<JustificativaPonto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('equipe_justificativas_ponto')
      .select('*')
      .neq('status', 'substituida')
      .order('data', { ascending: false });

    if (apenasMinhas) {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setJustificativas([]);
        setLoading(false);
        return;
      }
      query = query.eq('colaborador_id', auth.user.id);
    } else {
      if (empresaIds.length === 0) {
        setJustificativas([]);
        setLoading(false);
        return;
      }
      query = query.in('empresa_id', empresaIds);
    }

    const { data } = await query;
    setJustificativas((data ?? []) as JustificativaPonto[]);
    setLoading(false);
  }, [empresaIds.join(','), apenasMinhas]);

  useEffect(() => {
    load();
  }, [load]);

  const criar = async (params: {
    colaboradorId: string;
    data: string;
    tipo: JustificativaTipo;
    motivo: string;
    marcacoes: Marcacao[];
    atrasoId?: string | null;
    anexoPath?: string | null;
    valorPago?: number | null;
  }) => {
    const { error } = await supabase.rpc('equipe_criar_justificativa_ponto', {
      p_colaborador_id: params.colaboradorId,
      p_data: params.data,
      p_tipo: params.tipo,
      p_motivo: params.motivo,
      p_marcacoes: params.marcacoes as unknown as Json,
      p_atraso_id: params.atrasoId ?? null,
      p_anexo_path: params.anexoPath ?? null,
      p_valor_pago: params.valorPago ?? null,
    });

    if (error) {
      // As mensagens do banco já são escritas pra pessoa ler (citam o
      // intervalo mínimo, o prazo, etc.), então repassa direto.
      toast({ title: 'Não foi possível enviar', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Solicitação enviada' });
    await load();
    return true;
  };

  const decidir = async (justificativaId: string, aprovar: boolean, motivoRejeicao?: string) => {
    const { error } = await supabase.rpc('equipe_decidir_justificativa_ponto', {
      p_justificativa_id: justificativaId,
      p_aprovar: aprovar,
      p_motivo_rejeicao: motivoRejeicao ?? null,
    });
    if (error) {
      toast({ title: 'Não foi possível decidir', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: aprovar ? 'Solicitação aprovada' : 'Solicitação rejeitada' });
    await load();
    return true;
  };

  const darCiencia = async (justificativaId: string) => {
    const { error } = await supabase.rpc('equipe_registrar_ciencia', {
      p_alvo_tipo: 'justificativa',
      p_alvo_id: justificativaId,
      p_acao: 'ciente',
    });
    if (error) {
      toast({ title: 'Não foi possível registrar a ciência', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Ciência registrada' });
    await load();
    return true;
  };

  return { justificativas, loading, reload: load, criar, decidir, darCiencia };
};

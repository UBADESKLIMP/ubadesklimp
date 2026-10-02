import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';
import { TIPO_LABEL, type MarcacaoTipo } from '@/hooks/usePontoQuiosque';

export type Confirmacao = Database['public']['Enums']['ponto_confirmacao'];
export type MotivoRecusa = Database['public']['Enums']['ponto_motivo_recusa'];

export { TIPO_LABEL };
export type { MarcacaoTipo };

/** Situação de cada pessoa agora, calculada no banco (ponto_agora_na_loja). */
export interface SituacaoAgora {
  funcionario_id: string;
  nome: string;
  situacao: 'na loja' | 'em almoço' | 'em pausa' | 'saiu' | 'não chegou';
  desde: string | null;
}

export interface MarcacaoDoDia {
  id: string;
  nome: string;
  tipo: MarcacaoTipo;
  hora: string;
  local: string | null;
  origem: Database['public']['Enums']['ponto_origem'];
  confirmacao: Confirmacao;
  marcado_por: string | null;
  ip: string | null;
  codigo: string;
}

export const MOTIVO_LABEL: Record<MotivoRecusa, string> = {
  fora_da_rede: 'Fora da rede da loja',
  dispositivo_nao_aprovado: 'Celular não liberado',
  pin_invalido: 'PIN incorreto',
  conta_bloqueada: 'Conta bloqueada',
  sequencia_invalida: 'Sequência inválida',
  local_nao_permite: 'Local não aceita esse tipo',
  token_qr_invalido: 'QR vencido',
  estacao_invalida: 'Estação não registrada',
  duplicada: 'Batida repetida',
  rate_limit: 'Tentativas demais',
  sem_ip: 'Conexão não identificada',
  fora_da_janela: 'Fora da janela de abertura',
  sem_permissao: 'Sem permissão',
};

export const hojeISO = () => {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const usePontoAgora = (empresaId: string | null) => {
  const [pessoas, setPessoas] = useState<SituacaoAgora[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setPessoas([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase.rpc('ponto_agora_na_loja', { p_empresa_id: empresaId });
    setPessoas((data as unknown as SituacaoAgora[]) ?? []);
    setLoading(false);
  }, [empresaId]);

  // A tela do gestor fica aberta no balcão; sem o refresh ela mente em minutos.
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60 * 1000);
    return () => clearInterval(t);
  }, [carregar]);

  return { pessoas, loading, recarregar: carregar };
};

export const usePontoDoDia = (empresaId: string | null, data: string) => {
  const [marcacoes, setMarcacoes] = useState<MarcacaoDoDia[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setMarcacoes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: res } = await supabase.rpc('ponto_marcacoes_do_dia', {
      p_empresa_id: empresaId,
      p_data: data,
    });
    setMarcacoes((res as unknown as MarcacaoDoDia[]) ?? []);
    setLoading(false);
  }, [empresaId, data]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { marcacoes, loading, recarregar: carregar };
};

export interface Estacao {
  id: string;
  nome: string;
  local: string | null;
  ultimo_heartbeat: string | null;
  ultimo_ip: string | null;
  revogada_em: string | null;
}

export interface Rede {
  id: string;
  ip: string;
  origem: Database['public']['Enums']['ponto_rede_origem'];
  visto_em: string;
  ativo: boolean;
}

export interface TentativaRecusada {
  id: string;
  created_at: string;
  motivo: MotivoRecusa;
  detalhe: string | null;
  ip: string | null;
  nome: string | null;
}

export const usePontoInfra = (empresaId: string | null) => {
  const [estacoes, setEstacoes] = useState<Estacao[]>([]);
  const [redes, setRedes] = useState<Rede[]>([]);
  const [tentativas, setTentativas] = useState<TentativaRecusada[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setEstacoes([]);
      setRedes([]);
      setTentativas([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const [est, red, tent] = await Promise.all([
      supabase
        .from('ponto_estacoes')
        .select('id, nome, ultimo_heartbeat, ultimo_ip, revogada_em, ponto_locais(nome, empresa_id)')
        .order('created_at'),
      supabase
        .from('ponto_redes')
        .select('id, ip, origem, visto_em, ativo')
        .eq('empresa_id', empresaId)
        .order('visto_em', { ascending: false }),
      supabase
        .from('ponto_tentativas')
        .select('id, created_at, motivo, detalhe, ip, staff_members(display_name)')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    type LinhaEstacao = {
      id: string;
      nome: string;
      ultimo_heartbeat: string | null;
      ultimo_ip: string | null;
      revogada_em: string | null;
      ponto_locais: { nome: string; empresa_id: string } | null;
    };

    setEstacoes(
      ((est.data ?? []) as LinhaEstacao[])
        // ponto_estacoes não tem empresa_id: ela vem pelo local.
        .filter((e) => e.ponto_locais?.empresa_id === empresaId)
        .map((e) => ({
          id: e.id,
          nome: e.nome,
          local: e.ponto_locais?.nome ?? null,
          ultimo_heartbeat: e.ultimo_heartbeat,
          ultimo_ip: e.ultimo_ip,
          revogada_em: e.revogada_em,
        }))
    );

    setRedes((red.data ?? []) as Rede[]);

    type LinhaTentativa = {
      id: string;
      created_at: string;
      motivo: MotivoRecusa;
      detalhe: string | null;
      ip: string | null;
      staff_members: { display_name: string } | null;
    };

    setTentativas(
      ((tent.data ?? []) as LinhaTentativa[]).map((t) => ({
        id: t.id,
        created_at: t.created_at,
        motivo: t.motivo,
        detalhe: t.detalhe,
        ip: t.ip,
        nome: t.staff_members?.display_name ?? null,
      }))
    );

    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const revogarEstacao = async (id: string) => {
    const { error } = await supabase
      .from('ponto_estacoes')
      .update({ revogada_em: new Date().toISOString() })
      .eq('id', id);
    if (!error) await carregar();
    return !error;
  };

  const alternarRede = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from('ponto_redes').update({ ativo }).eq('id', id);
    if (!error) await carregar();
    return !error;
  };

  const liberarIpAtual = async (ip: string) => {
    if (!empresaId) return false;
    const { error } = await supabase
      .from('ponto_redes')
      .upsert({ empresa_id: empresaId, ip, origem: 'manual', ativo: true }, { onConflict: 'empresa_id,ip' });
    if (!error) await carregar();
    return !error;
  };

  return { estacoes, redes, tentativas, loading, recarregar: carregar, revogarEstacao, alternarRede, liberarIpAtual };
};

export interface MinhaMarcacao {
  id: string;
  tipo: MarcacaoTipo;
  registrado_em: string;
  origem: Database['public']['Enums']['ponto_origem'];
  confirmacao: Confirmacao;
  hash: string;
}

/** O que o próprio funcionário vê: as batidas dele e o que falta confirmar. */
export const useMeuPonto = (dias = 7) => {
  const { user } = useAuth();
  const [marcacoes, setMarcacoes] = useState<MinhaMarcacao[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) {
      setMarcacoes([]);
      setLoading(false);
      return;
    }
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('ponto_marcacoes')
      .select('id, tipo, registrado_em, origem, confirmacao, hash')
      .eq('funcionario_id', user.id)
      .gte('registrado_em', desde)
      .order('registrado_em', { ascending: false });
    setMarcacoes((data ?? []) as MinhaMarcacao[]);
    setLoading(false);
  }, [user, dias]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const responder = async (marcacaoId: string, confirma: boolean) => {
    const { error } = await supabase.rpc('ponto_confirmar_marcacao', {
      p_marcacao_id: marcacaoId,
      p_confirma: confirma,
    });
    if (!error) await carregar();
    return !error;
  };

  return {
    marcacoes,
    pendentes: marcacoes.filter((m) => m.confirmacao === 'pendente'),
    loading,
    recarregar: carregar,
    responder,
  };
};

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

export interface PessoaDaEmpresa {
  id: string;
  nome: string;
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
  /** Por que o gestor lançou esta batida no lugar da pessoa. */
  motivo_lancamento: string | null;
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

  const [pessoas, setPessoas] = useState<PessoaDaEmpresa[]>([]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // A lista de nomes só existe aqui, no painel: o gestor lança por alguém e
  // não sabe — nem deve saber — o PIN de ninguém.
  useEffect(() => {
    if (!empresaId) {
      setPessoas([]);
      return;
    }
    supabase
      .rpc('ponto_pessoas_da_empresa', { p_empresa_id: empresaId })
      .then(({ data }) => setPessoas((data as unknown as PessoaDaEmpresa[]) ?? []));
  }, [empresaId]);

  const lancarMarcacao = async (
    funcionarioId: string,
    tipo: MarcacaoTipo,
    quando: string,
    motivo: string
  ) => {
    const { data, error } = await supabase.rpc('ponto_lancar_marcacao', {
      p_funcionario_id: funcionarioId,
      p_tipo: tipo,
      p_quando: quando,
      p_motivo: motivo,
    });
    if (error) return { ok: false, mensagem: error.message };
    const r = data as unknown as { ok: boolean; mensagem?: string };
    if (r?.ok) await carregar();
    return r;
  };

  return { marcacoes, pessoas, loading, recarregar: carregar, lancarMarcacao };
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
  /** Quem o quiosque não reconhece, porque o PIN é procurado por empresa. */
  const [semEmpresa, setSemEmpresa] = useState<string[]>([]);
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

    const [est, red, tent, soltos] = await Promise.all([
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
      supabase.from('staff_members').select('display_name').is('empresa_id', null),
    ]);

    setSemEmpresa(
      ((soltos.data ?? []) as { display_name: string }[]).map((s) => s.display_name)
    );

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

  /**
   * Cadastra a rede de onde o admin está chamando. Quem lê o IP é o servidor:
   * o navegador não conhece o próprio IP público, e aceitar um IP vindo do
   * cliente seria justamente a fraude que o módulo existe pra impedir.
   */
  const liberarRedeAtual = async () => {
    if (!empresaId) return { ok: false, mensagem: 'Sem empresa.' };
    const { data, error } = await supabase.rpc('ponto_liberar_rede_atual', {
      p_empresa_id: empresaId,
    });
    if (error) return { ok: false, mensagem: error.message };
    const r = data as unknown as { ok: boolean; ip?: string; mensagem?: string };
    if (r?.ok) await carregar();
    return r;
  };

  /**
   * Prepara um computador e devolve o código que alguém digita lá no balcão.
   * O código em claro só volta nesta chamada — o banco guarda só o hash.
   */
  const prepararEstacao = async (nome: string) => {
    if (!empresaId) return { ok: false, mensagem: 'Sem empresa.' };
    const { data, error } = await supabase.rpc('ponto_preparar_estacao', {
      p_empresa_id: empresaId,
      p_nome: nome,
    });
    if (error) return { ok: false, mensagem: error.message };
    return data as unknown as { ok: boolean; codigo?: string; expira_em?: string; mensagem?: string };
  };

  return {
    estacoes,
    redes,
    tentativas,
    semEmpresa,
    loading,
    recarregar: carregar,
    revogarEstacao,
    alternarRede,
    liberarRedeAtual,
    prepararEstacao,
  };
};

export interface LocalQr {
  id: string;
  nome: string;
  ativo: boolean;
  marcacoes: MarcacaoTipo[];
  /** Se nunca geraram token, o cartaz ainda não existe. */
  tem_token: boolean;
}

export interface DispositivoPendente {
  id: string;
  funcionario_id: string;
  nome: string;
  apelido: string | null;
  status: Database['public']['Enums']['ponto_dispositivo_status'];
  created_at: string;
  aprovado_em: string | null;
}

/** Pontos de QR (cozinha, etc.) e celulares esperando liberação. */
export const usePontoQrEDispositivos = (empresaId: string | null) => {
  const [locais, setLocais] = useState<LocalQr[]>([]);
  const [dispositivos, setDispositivos] = useState<DispositivoPendente[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setLocais([]);
      setDispositivos([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const [locaisRes, devsRes] = await Promise.all([
      supabase
        .from('ponto_locais')
        .select('id, nome, ativo, marcacoes_permitidas, qr_token_hash')
        .eq('empresa_id', empresaId)
        .eq('tipo', 'qr')
        .order('created_at'),
      supabase
        .from('ponto_dispositivos')
        // ponto_dispositivos tem duas FKs pra staff_members (dono e quem
        // aprovou): sem dizer qual, o PostgREST não sabe escolher.
        .select(
          'id, funcionario_id, apelido, status, created_at, aprovado_em, staff_members!ponto_dispositivos_funcionario_id_fkey(display_name)'
        )
        .order('created_at', { ascending: false }),
    ]);

    type LinhaLocal = {
      id: string;
      nome: string;
      ativo: boolean;
      marcacoes_permitidas: MarcacaoTipo[];
      qr_token_hash: string | null;
    };

    setLocais(
      ((locaisRes.data ?? []) as LinhaLocal[]).map((l) => ({
        id: l.id,
        nome: l.nome,
        ativo: l.ativo,
        marcacoes: l.marcacoes_permitidas ?? [],
        tem_token: Boolean(l.qr_token_hash),
      }))
    );

    type LinhaDev = {
      id: string;
      funcionario_id: string;
      apelido: string | null;
      status: Database['public']['Enums']['ponto_dispositivo_status'];
      created_at: string;
      aprovado_em: string | null;
      staff_members: { display_name: string } | null;
    };

    setDispositivos(
      ((devsRes.data ?? []) as LinhaDev[]).map((d) => ({
        id: d.id,
        funcionario_id: d.funcionario_id,
        nome: d.staff_members?.display_name ?? 'Colaborador',
        apelido: d.apelido,
        status: d.status,
        created_at: d.created_at,
        aprovado_em: d.aprovado_em,
      }))
    );

    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criarLocalQr = async (nome: string) => {
    if (!empresaId) return { ok: false, mensagem: 'Sem empresa.' };
    const { data, error } = await supabase.rpc('ponto_criar_local_qr', {
      p_empresa_id: empresaId,
      p_nome: nome,
    });
    if (error) return { ok: false, mensagem: error.message };
    await carregar();
    return data as unknown as { ok: boolean; local_id: string; token: string };
  };

  const rotacionarQr = async (localId: string) => {
    const { data, error } = await supabase.rpc('ponto_rotacionar_qr', { p_local_id: localId });
    if (error) return { ok: false, mensagem: error.message };
    await carregar();
    return data as unknown as { ok: boolean; token: string };
  };

  const decidirDispositivo = async (id: string, aprovar: boolean) => {
    const { error } = await supabase.rpc('ponto_decidir_dispositivo', {
      p_dispositivo_id: id,
      p_aprovar: aprovar,
    });
    if (!error) await carregar();
    return !error;
  };

  return {
    locais,
    dispositivos,
    pendentes: dispositivos.filter((d) => d.status === 'pendente'),
    loading,
    recarregar: carregar,
    criarLocalQr,
    rotacionarQr,
    decidirDispositivo,
  };
};

/**
 * Pausas de café por empresa (PRD R4). Nasce desligada: dividir o intervalo em
 * almoço + café é zona cinzenta e precisa de aditivo ou acordo antes.
 */
export const usePausasCafe = (empresaId: string | null) => {
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setAtivo(null);
      return;
    }
    const { data } = await supabase.rpc('ponto_cafe_ativo', { p_empresa_id: empresaId });
    setAtivo(Boolean(data));
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const definir = async (novo: boolean) => {
    if (!empresaId) return false;
    setSalvando(true);
    const { error } = await supabase
      .from('ponto_config')
      .upsert(
        { empresa_id: empresaId, chave: 'pausas_cafe_ativas', valor: novo, updated_at: new Date().toISOString() },
        { onConflict: 'empresa_id,chave' }
      );
    setSalvando(false);
    if (!error) await carregar();
    return !error;
  };

  return { ativo, salvando, definir };
};

/** PIN de manutenção do quiosque: é ele que libera o resto do admin no PC. */
export const usePinManutencao = (empresaId: string | null) => {
  const [definido, setDefinido] = useState<boolean | null>(null);

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setDefinido(null);
      return;
    }
    const { data } = await supabase.rpc('ponto_tem_pin_manutencao', { p_empresa_id: empresaId });
    setDefinido(Boolean(data));
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const definir = async (pin: string) => {
    if (!empresaId) return { ok: false, mensagem: 'Sem empresa.' };
    const { error } = await supabase.rpc('ponto_definir_pin_manutencao', {
      p_empresa_id: empresaId,
      p_pin: pin,
    });
    if (error) return { ok: false, mensagem: error.message };
    await carregar();
    return { ok: true };
  };

  return { definido, definir };
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

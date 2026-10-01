import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database, Json } from '@/integrations/supabase/types';

type Marcacao = Database['public']['Enums']['equipe_marcacao'];
type AtrasoStatus = Database['public']['Enums']['equipe_atraso_status'];
type MedidaTipo = Database['public']['Enums']['equipe_medida_tipo'];

export interface EquipeColaborador {
  user_id: string;
  display_name: string;
  empresa_id: string | null;
  escala_id: string | null;
  almoco_previsto: string | null;
  duracao_almoco_min: number;
  termo_assinado_em: string | null;
}

export interface EquipeAtraso {
  id: string;
  colaborador_id: string;
  empresa_id: string;
  data: string;
  marcacao: Marcacao;
  horario_previsto: string | null;
  horario_referencia: string | null;
  hora_chegada: string;
  hora_chegada_porta: string | null;
  estava_na_porta: boolean;
  saida_almoco_real: string | null;
  desvio_saida_almoco_min: number | null;
  minutos_atraso: number | null;
  dentro_tolerancia: boolean | null;
  status: AtrasoStatus;
  created_at: string;
}

export interface PreviaAtraso {
  horario_previsto: string | null;
  horario_referencia: string | null;
  variacao_bruta_min: number;
  desvio_saida_almoco_min: number | null;
  minutos_atraso: number;
  dentro_tolerancia: boolean;
  soma_dia_min: number;
  abertura_atrasada: boolean;
}

const hoje = () => new Date().toISOString().slice(0, 10);

/** Colaboradores das empresas que o usuário logado pode ver. */
export const useEquipeColaboradores = (empresaIds: string[]) => {
  const [colaboradores, setColaboradores] = useState<EquipeColaborador[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (empresaIds.length === 0) {
      setColaboradores([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('staff_members')
      .select('user_id, display_name, empresa_id, escala_id, almoco_previsto, duracao_almoco_min, termo_assinado_em')
      .in('empresa_id', empresaIds)
      .order('display_name');
    setColaboradores((data ?? []) as EquipeColaborador[]);
    setLoading(false);
  }, [empresaIds.join(',')]);

  useEffect(() => {
    load();
  }, [load]);

  return { colaboradores, loading, reload: load };
};

/** Nome das empresas visíveis, pro seletor mostrar razão social em vez de id. */
export const useEquipeEmpresas = (empresaIds: string[]) => {
  const [empresas, setEmpresas] = useState<{ id: string; razao_social: string }[]>([]);

  useEffect(() => {
    if (empresaIds.length === 0) {
      setEmpresas([]);
      return;
    }
    let cancelado = false;
    supabase
      .from('empresas')
      .select('id, razao_social')
      .in('id', empresaIds)
      .order('razao_social')
      .then(({ data }) => {
        if (!cancelado) setEmpresas(data ?? []);
      });
    return () => {
      cancelado = true;
    };
  }, [empresaIds.join(',')]);

  return empresas;
};

/** Abertura do dia de uma empresa (regra da porta). */
export interface PresenteNaPorta {
  colaborador_id: string;
  hora_chegada_porta: string | null;
}

export const useAberturaDoDia = (empresaId: string | null, data = hoje()) => {
  const { toast } = useToast();
  const [horaAbertura, setHoraAbertura] = useState<string | null>(null);
  const [presentes, setPresentes] = useState<PresenteNaPorta[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    if (!empresaId) {
      setHoraAbertura(null);
      setPresentes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: row }, { data: presentesRows }] = await Promise.all([
      supabase
        .from('equipe_aberturas')
        .select('hora_abertura')
        .eq('empresa_id', empresaId)
        .eq('data', data)
        .maybeSingle(),
      supabase
        .from('equipe_abertura_presentes')
        .select('colaborador_id, hora_chegada_porta')
        .eq('empresa_id', empresaId)
        .eq('data', data),
    ]);
    setHoraAbertura(row?.hora_abertura ?? null);
    setPresentes(presentesRows ?? []);
    setLoading(false);
  }, [empresaId, data]);

  useEffect(() => {
    load();
  }, [load]);

  const registrarAbertura = async (hora: string, motivo?: string) => {
    if (!empresaId) return false;
    setSalvando(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('equipe_aberturas').upsert(
      {
        empresa_id: empresaId,
        data,
        hora_abertura: hora,
        motivo: motivo || null,
        registrado_por: auth.user?.id as string,
      },
      { onConflict: 'empresa_id,data' }
    );
    setSalvando(false);
    if (error) {
      toast({ title: 'Não foi possível registrar a abertura', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: `Abertura registrada às ${hora.slice(0, 5)}` });
    await load();
    return true;
  };

  /** Substitui a lista inteira de quem estava na porta nesse dia. */
  const registrarPresentes = async (lista: PresenteNaPorta[]) => {
    if (!empresaId) return false;
    setSalvando(true);
    const { error } = await supabase.rpc('equipe_registrar_presentes_porta', {
      p_empresa_id: empresaId,
      p_data: data,
      p_presentes: lista as unknown as Json,
    });
    setSalvando(false);
    if (error) {
      toast({ title: 'Não foi possível salvar', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({
      title: lista.length === 0 ? 'Lista limpa' : `${lista.length} na porta`,
      description: 'Vai vir marcado quando você lançar o atraso dessas pessoas.',
    });
    await load();
    return true;
  };

  return {
    horaAbertura,
    presentes,
    loading,
    salvando,
    registrarAbertura,
    registrarPresentes,
    reload: load,
  };
};

export const useEquipeAtrasos = (empresaIds: string[]) => {
  const { toast } = useToast();
  const [atrasos, setAtrasos] = useState<EquipeAtraso[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (empresaIds.length === 0) {
      setAtrasos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('equipe_atrasos')
      .select('*')
      .in('empresa_id', empresaIds)
      .neq('status', 'substituido')
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
    setAtrasos((data ?? []) as EquipeAtraso[]);
    setLoading(false);
  }, [empresaIds.join(',')]);

  useEffect(() => {
    load();
  }, [load]);

  /** Prévia do cálculo vinda do banco — o front nunca recalcula a regra. */
  const pedirPrevia = async (params: {
    colaboradorId: string;
    empresaId: string;
    data: string;
    marcacao: Marcacao;
    horaChegada: string;
    estavaNaPorta?: boolean;
    horaChegadaPorta?: string | null;
    saidaAlmocoReal?: string | null;
  }): Promise<PreviaAtraso | null> => {
    const { data, error } = await supabase.rpc('equipe_calcular_atraso', {
      p_colaborador_id: params.colaboradorId,
      p_empresa_id: params.empresaId,
      p_data: params.data,
      p_marcacao: params.marcacao,
      p_hora_chegada: params.horaChegada,
      p_estava_na_porta: params.estavaNaPorta ?? false,
      p_hora_chegada_porta: params.horaChegadaPorta ?? null,
      p_saida_almoco_real: params.saidaAlmocoReal ?? null,
      p_duracao_almoco_override_min: null,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return (row as PreviaAtraso) ?? null;
  };

  const lancarAtraso = async (params: {
    colaboradorId: string;
    empresaId: string;
    data: string;
    marcacao: Marcacao;
    horaChegada: string;
    estavaNaPorta?: boolean;
    horaChegadaPorta?: string | null;
    saidaAlmocoReal?: string | null;
  }) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('equipe_atrasos').insert({
      colaborador_id: params.colaboradorId,
      empresa_id: params.empresaId,
      data: params.data,
      marcacao: params.marcacao,
      hora_chegada: params.horaChegada,
      estava_na_porta: params.estavaNaPorta ?? false,
      hora_chegada_porta: params.horaChegadaPorta ?? null,
      saida_almoco_real: params.saidaAlmocoReal ?? null,
      criado_por: auth.user?.id as string,
    });
    if (error) {
      toast({ title: 'Não foi possível lançar o atraso', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Atraso lançado' });
    await load();
    return true;
  };

  return { atrasos, loading, reload: load, pedirPrevia, lancarAtraso };
};

/** Contador do mês + medida sugerida, ambos calculados no banco. */
export const useEscalonamento = (colaboradorId: string | null, referencia = hoje()) => {
  const [contagem, setContagem] = useState<number | null>(null);
  const [sugestao, setSugestao] = useState<MedidaTipo | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!colaboradorId) {
      setContagem(null);
      setSugestao(null);
      return;
    }
    setLoading(true);
    const [{ data: cont }, { data: sug }] = await Promise.all([
      supabase.rpc('equipe_contar_atrasos_mes', {
        p_colaborador_id: colaboradorId,
        p_referencia: referencia,
      }),
      supabase.rpc('equipe_sugerir_medida', {
        p_colaborador_id: colaboradorId,
        p_referencia: referencia,
      }),
    ]);
    setContagem(typeof cont === 'number' ? cont : null);
    setSugestao((sug as MedidaTipo) ?? null);
    setLoading(false);
  }, [colaboradorId, referencia]);

  useEffect(() => {
    load();
  }, [load]);

  return { contagem, sugestao, loading, reload: load };
};

/** Registros do próprio colaborador logado + ciência/justificativa. */
export const useMeusRegistros = () => {
  const { toast } = useToast();
  const [atrasos, setAtrasos] = useState<EquipeAtraso[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setAtrasos([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('equipe_atrasos')
      .select('*')
      .eq('colaborador_id', auth.user.id)
      .neq('status', 'substituido')
      .order('data', { ascending: false });
    setAtrasos((data ?? []) as EquipeAtraso[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const darCiencia = async (atrasoId: string) => {
    const { error } = await supabase.rpc('equipe_registrar_ciencia', {
      p_alvo_tipo: 'atraso',
      p_alvo_id: atrasoId,
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

  const justificar = async (atrasoId: string, texto: string) => {
    const { error } = await supabase
      .from('equipe_justificativas_atraso')
      .insert({ atraso_id: atrasoId, texto });
    if (error) {
      toast({ title: 'Não foi possível enviar a justificativa', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Justificativa enviada', description: 'O gestor vai avaliar.' });
    await load();
    return true;
  };

  return { atrasos, loading, reload: load, darCiencia, justificar };
};

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type MarcacaoTipo = Database['public']['Enums']['ponto_marcacao_tipo'];

/** O token da estação vive no navegador do PC — é o que identifica o quiosque. */
const CHAVE_TOKEN = 'ubadesklimp.ponto.estacao';

export const lerTokenEstacao = () => {
  try {
    return localStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
};

export const gravarTokenEstacao = (token: string) => {
  try {
    localStorage.setItem(CHAVE_TOKEN, token);
  } catch {
    /* navegador sem storage: o quiosque simplesmente não fica registrado */
  }
};

export const limparTokenEstacao = () => {
  try {
    localStorage.removeItem(CHAVE_TOKEN);
  } catch {
    /* idem */
  }
};

export interface FuncionarioDoQuiosque {
  id: string;
  nome: string;
  pode_abrir_loja: boolean;
}

export interface ContextoEstacao {
  ok: boolean;
  motivo?: string;
  estacao?: string;
  local?: string;
  empresa_id?: string;
  rede_ok?: boolean;
  funcionarios?: FuncionarioDoQuiosque[];
}

export interface ResultadoBatida {
  ok: boolean;
  motivo?: string;
  mensagem?: string;
  ignorada?: boolean;
  tipo?: MarcacaoTipo;
  registrado_em?: string;
  local?: string;
  codigo?: string;
  proxima_sugerida?: MarcacaoTipo;
}

export const TIPO_LABEL: Record<MarcacaoTipo, string> = {
  entrada: 'Entrada',
  saida_almoco: 'Saída para o almoço',
  retorno_almoco: 'Retorno do almoço',
  saida: 'Saída',
  hora_extra_inicio: 'Início da hora extra',
  hora_extra_saida: 'Fim da hora extra',
  saida_pausa: 'Saída para a pausa',
  retorno_pausa: 'Retorno da pausa',
};

export const usePontoQuiosque = () => {
  const [token, setToken] = useState<string | null>(lerTokenEstacao());
  const [contexto, setContexto] = useState<ContextoEstacao | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregarContexto = useCallback(async () => {
    if (!token) {
      setContexto(null);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const { data, error } = await supabase.rpc('ponto_estacao_contexto', {
      p_estacao_token: token,
    });
    setCarregando(false);
    if (error) {
      setContexto({ ok: false, motivo: 'erro' });
      return;
    }
    setContexto(data as unknown as ContextoEstacao);
  }, [token]);

  useEffect(() => {
    carregarContexto();
  }, [carregarContexto]);

  // O heartbeat é o que mantém o IP da loja atualizado quando o provedor troca
  // (PRD 4.1). Roda ao abrir e a cada 5 min enquanto o quiosque estiver aberto.
  useEffect(() => {
    if (!token) return;
    // O builder do supabase-js é preguiçoso: sem await (ou .then) a requisição
    // nunca sai. Sem isso o IP da loja nunca se atualiza sozinho e, no dia em
    // que o provedor trocar o IP, ninguém consegue bater ponto.
    const bater = async () => {
      await supabase.rpc('ponto_heartbeat', { p_estacao_token: token });
    };
    bater();
    const intervalo = setInterval(bater, 5 * 60 * 1000);
    return () => clearInterval(intervalo);
  }, [token]);

  const registrarEstacao = async (nome: string) => {
    const { data, error } = await supabase.rpc('ponto_registrar_estacao', { p_nome: nome });
    if (error) return { ok: false, mensagem: error.message };
    const r = data as unknown as { ok: boolean; token?: string };
    if (r?.ok && r.token) {
      gravarTokenEstacao(r.token);
      setToken(r.token);
      return { ok: true };
    }
    return { ok: false, mensagem: 'Não foi possível registrar este computador.' };
  };

  const baterPonto = async (
    funcionarioId: string,
    pin: string,
    tipo?: MarcacaoTipo
  ): Promise<ResultadoBatida> => {
    if (!token) return { ok: false, mensagem: 'Este computador não está registrado.' };
    const { data, error } = await supabase.rpc('ponto_registrar', {
      p_funcionario_id: funcionarioId,
      p_pin: pin,
      p_tipo: tipo ?? undefined,
      p_estacao_token: token,
    });
    if (error) {
      return { ok: false, mensagem: 'Não conseguimos registrar agora. Tente de novo.' };
    }
    return data as unknown as ResultadoBatida;
  };

  return {
    token,
    contexto,
    carregando,
    recarregar: carregarContexto,
    registrarEstacao,
    baterPonto,
    desregistrar: () => {
      limparTokenEstacao();
      setToken(null);
    },
  };
};

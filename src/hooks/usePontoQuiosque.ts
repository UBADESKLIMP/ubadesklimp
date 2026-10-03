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

/**
 * Liberação do modo quiosque pelo PIN de manutenção (PRD 4.6).
 * Fica em sessionStorage de propósito: fechou o navegador ou reiniciou o PC,
 * volta a ser quiosque sozinho (P31) — ninguém precisa lembrar de retrancar.
 */
const CHAVE_LIBERADO = 'ubadesklimp.ponto.liberado';

/**
 * Só tranca o navegador depois que a empresa tem PIN de manutenção — senão
 * registrar o próprio PC deixaria a pessoa sem painel e sem saída. O banco diz
 * se já existe PIN; aqui só se guarda a resposta pro guarda de rota ler sem
 * precisar de sessão.
 */
const CHAVE_TRAVADO = 'ubadesklimp.ponto.travado';

export const quiosqueTravado = () => {
  try {
    return localStorage.getItem(CHAVE_TRAVADO) === '1';
  } catch {
    return false;
  }
};

const definirTrava = (travado: boolean) => {
  try {
    if (travado) localStorage.setItem(CHAVE_TRAVADO, '1');
    else localStorage.removeItem(CHAVE_TRAVADO);
  } catch {
    /* sem storage: não tranca */
  }
};

export const quiosqueLiberado = () => {
  try {
    return sessionStorage.getItem(CHAVE_LIBERADO) === '1';
  } catch {
    return false;
  }
};

export const retrancarQuiosque = () => {
  try {
    sessionStorage.removeItem(CHAVE_LIBERADO);
  } catch {
    /* idem */
  }
};

export const liberarQuiosque = () => {
  try {
    sessionStorage.setItem(CHAVE_LIBERADO, '1');
  } catch {
    /* sem storage: segue trancado, que é o lado seguro */
  }
};

export interface FuncionarioDoQuiosque {
  id: string;
  nome: string;
  pode_abrir_loja: boolean;
}

export type Atalho = 'bater_ponto' | 'abrir_loja' | 'reportar_faltante';

export interface FichaDaEstacao {
  ok: boolean;
  motivo?: string;
  mensagem?: string;
  nome?: string;
  local?: string;
  atalhos?: Atalho[];
  ultimo_ip?: string | null;
  ultimo_heartbeat?: string | null;
  registrado_em?: string;
  batidas_hoje?: number;
}

export interface ContextoEstacao {
  ok: boolean;
  motivo?: string;
  estacao?: string;
  local?: string;
  empresa_id?: string;
  rede_ok?: boolean;
  modo_quiosque?: boolean;
  estacao_id?: string;
  atalhos?: Atalho[];
  funcionarios?: FuncionarioDoQuiosque[];
}

export interface PendenteDaAbertura {
  funcionario_id: string;
  nome: string;
}

export interface ResultadoAbertura {
  nome?: string;
  ok: boolean;
  motivo?: string;
  mensagem?: string;
  origem?: 'estacao' | 'celular';
  hora_abertura?: string;
  pendentes?: PendenteDaAbertura[];
}

export interface ResultadoPresentes {
  ok: boolean;
  motivo?: string;
  mensagem?: string;
  entradas_registradas?: number;
  hora?: string;
}

export interface ProdutoDoQuiosque {
  id: string;
  nome: string;
  marca: string | null;
}

export interface ResultadoFaltante {
  ok: boolean;
  motivo?: string;
  mensagem?: string;
  ja_existia?: boolean;
  produto?: string;
  reportes?: number;
}

export interface ResultadoBatida {
  /** Quem bateu. Só volta depois do PIN conferir. */
  nome?: string;
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
    const ctx = data as unknown as ContextoEstacao;
    setContexto(ctx);
    definirTrava(Boolean(ctx?.ok && ctx.modo_quiosque));
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

  /**
   * Caminho normal: o admin gera o código no painel e alguém digita aqui. Não
   * exige login nenhum neste computador — o que evita a senha de admin morar
   * num micro que fica ligado o dia inteiro na frente da loja.
   */
  const ativarComCodigo = async (codigo: string) => {
    const { data, error } = await supabase.rpc('ponto_ativar_estacao', { p_codigo: codigo });
    if (error) return { ok: false, mensagem: 'Não conseguimos verificar agora. Tente de novo.' };
    const r = data as unknown as { ok: boolean; token?: string; mensagem?: string };
    if (r?.ok && r.token) {
      gravarTokenEstacao(r.token);
      setToken(r.token);
      return { ok: true };
    }
    return { ok: false, mensagem: r?.mensagem ?? 'Código inválido.' };
  };

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

  /** Passo 1 da abertura coletiva: o PIN diz quem está abrindo. */
  const abrirLojaPorPin = async (pin: string, motivo?: string) => {
    if (!token) return { ok: false, mensagem: 'Este computador não está registrado.' };
    const { data, error } = await supabase.rpc('ponto_abrir_loja_por_pin', {
      p_pin: pin,
      p_estacao_token: token,
      p_motivo: motivo ?? undefined,
    });
    if (error) return { ok: false, mensagem: 'Não conseguimos abrir a loja agora. Tente de novo.' };
    return data as unknown as ResultadoAbertura;
  };

  /** Passo 2: gera as entradas de quem estava na porta. */
  const marcarPresentesPorPin = async (pin: string, funcionarios: string[]) => {
    if (!token) return { ok: false, mensagem: 'Este computador não está registrado.' };
    const { data, error } = await supabase.rpc('ponto_marcar_presentes_por_pin', {
      p_pin: pin,
      p_estacao_token: token,
      p_funcionarios: funcionarios,
    });
    if (error) return { ok: false, mensagem: 'Não conseguimos marcar agora. Tente de novo.' };
    return data as unknown as ResultadoPresentes;
  };

  const buscarProduto = async (termo: string): Promise<ProdutoDoQuiosque[]> => {
    if (!token) return [];
    const { data, error } = await supabase.rpc('ponto_buscar_produto', {
      p_estacao_token: token,
      p_termo: termo,
    });
    if (error) return [];
    const r = data as unknown as { ok: boolean; produtos?: ProdutoDoQuiosque[] };
    return r?.produtos ?? [];
  };

  const reportarFaltantePorPin = async (pin: string, produtoId: string, sobrando?: number | null) => {
    if (!token) return { ok: false, mensagem: 'Este computador não está registrado.' };
    const { data, error } = await supabase.rpc('ponto_reportar_faltante_por_pin', {
      p_pin: pin,
      p_estacao_token: token,
      p_product_id: produtoId,
      p_stock_remaining: sobrando ?? undefined,
    });
    if (error) return { ok: false, mensagem: 'Não conseguimos registrar agora. Tente de novo.' };
    return data as unknown as ResultadoFaltante;
  };

  /** Ficha do aparelho pro bastidor. O PIN é conferido no banco de novo. */
  const abrirBastidor = async (pin: string): Promise<FichaDaEstacao> => {
    if (!token) return { ok: false, mensagem: 'Este computador não está registrado.' };
    const { data, error } = await supabase.rpc('ponto_estacao_ficha', {
      p_estacao_token: token,
      p_pin: pin,
    });
    if (error) return { ok: false, mensagem: 'Não conseguimos abrir agora.' };
    const r = data as unknown as FichaDaEstacao;
    // Entrar no bastidor já destrava o navegador: quem tem o PIN de
    // manutenção pode sair pro painel sem digitar duas vezes.
    if (r?.ok) liberarQuiosque();
    return r;
  };

  const salvarAtalhos = async (pin: string, atalhos: Atalho[]) => {
    if (!token) return { ok: false, mensagem: 'Este computador não está registrado.' };
    const { data, error } = await supabase.rpc('ponto_definir_atalhos', {
      p_estacao_token: token,
      p_pin: pin,
      p_atalhos: atalhos,
    });
    if (error) return { ok: false, mensagem: 'Não conseguimos salvar agora.' };
    const r = data as unknown as { ok: boolean; mensagem?: string };
    if (r?.ok) await carregarContexto();
    return r;
  };

  /** Volta a trancar este navegador no quiosque. */
  const voltarAoModoFacil = () => {
    retrancarQuiosque();
    carregarContexto();
  };

  /** PIN de manutenção: libera o resto do admin neste navegador até fechar. */
  const sairDoQuiosque = async (pin: string) => {
    if (!token) return { ok: false, mensagem: 'Este computador não está registrado.' };
    const { data, error } = await supabase.rpc('ponto_sair_do_quiosque', {
      p_estacao_token: token,
      p_pin: pin,
    });
    if (error) return { ok: false, mensagem: 'Não conseguimos verificar agora.' };
    const r = data as unknown as { ok: boolean; mensagem?: string };
    if (r?.ok) liberarQuiosque();
    return r;
  };

  /**
   * O PIN diz quem é a pessoa: não há lista de nomes na tela. O nome só volta
   * no comprovante, depois do PIN conferir.
   */
  const baterPontoPorPin = async (pin: string, tipo?: MarcacaoTipo): Promise<ResultadoBatida> => {
    if (!token) return { ok: false, mensagem: 'Este computador não está registrado.' };
    const { data, error } = await supabase.rpc('ponto_registrar_por_pin', {
      p_pin: pin,
      p_estacao_token: token,
      p_tipo: tipo ?? undefined,
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
    ativarComCodigo,
    abrirBastidor,
    salvarAtalhos,
    voltarAoModoFacil,
    baterPontoPorPin,
    abrirLojaPorPin,
    marcarPresentesPorPin,
    buscarProduto,
    reportarFaltantePorPin,
    sairDoQuiosque,
    desregistrar: () => {
      limparTokenEstacao();
      setToken(null);
    },
  };
};

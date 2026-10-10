import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type EntregaSituacao = Database['public']['Enums']['entrega_situacao'];
export type EntregaMotivo = Database['public']['Enums']['entrega_motivo'];
export type EntregaEventoTipo = Database['public']['Enums']['entrega_evento_tipo'];

/**
 * O motivo é escolhido por quem está na porta do cliente, com o carro ligado.
 * Por isso o rótulo é a frase que ele diria, não o nome técnico do enum.
 */
export const MOTIVO_LABEL: Record<EntregaMotivo, string> = {
  fechado: 'Estava fechado',
  ninguem_atendeu: 'Ninguém atendeu',
  endereco_errado: 'Endereço errado',
  cliente_recusou: 'Cliente recusou',
  nao_coube: 'Não coube no carro',
  outro: 'Outro motivo',
};

export const SITUACAO_LABEL: Record<EntregaSituacao, string> = {
  na_fila: 'Na fila',
  em_rota: 'Em rota',
  entregue: 'Entregue',
  nao_entregue: 'Não entregue',
  cancelada: 'Cancelada',
};

/**
 * O item vem do ERP e o formato ainda não foi confirmado (o Excel de exemplo
 * nunca saiu). Tudo é opcional de propósito: a tela mostra o que vier e não
 * quebra com o que faltar.
 */
export interface ItemEntrega {
  descricao?: string;
  quantidade?: number | string;
  unidade?: string;
}

export interface EntregaDaFila {
  id: string;
  documento_tipo: string;
  documento_numero: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  valor: number | null;
  itens: ItemEntrega[];
  situacao: EntregaSituacao;
  tentativas: number;
  bairro: string | null;
  endereco: string | null;
  entregar_em: string | null;
  ultimo_motivo: EntregaMotivo | null;
  ultima_tentativa: string | null;
}

export interface EventoDaParada {
  tipo: EntregaEventoTipo;
  motivo: EntregaMotivo | null;
  motivo_texto: string | null;
  quem_recebeu: string | null;
  /** Já vem "HH:MM" no fuso de São Paulo, pronto pra tela. */
  hora: string | null;
  lat: number | null;
  lng: number | null;
  precisao_m: number | null;
  ip: string | null;
}

export interface ParadaDaRota {
  parada_id: string;
  entrega_id: string;
  ordem: number;
  documento: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  bairro: string | null;
  endereco: string | null;
  entregar_em: string | null;
  itens: ItemEntrega[];
  valor: number | null;
  situacao: EntregaSituacao;
  evento: EventoDaParada | null;
}

export interface RotaDoDia {
  existe: boolean;
  rota_id?: string;
  data: string;
  invertida?: boolean;
  paradas: ParadaDaRota[];
}

export interface ResultadoRpc {
  ok: boolean;
  mensagem?: string;
  motivo?: string;
}

export interface ResultadoImportacao extends ResultadoRpc {
  criadas?: number;
  atualizadas?: number;
  ignoradas?: number;
  bairros_novos?: string[];
}

/** Hoje em Ubatuba, não no fuso do navegador. 'sv-SE' dá YYYY-MM-DD de graça. */
export const hojeEmSaoPaulo = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());

/** Valor nulo vira traço, não "R$ 0,00" — é dado que falta, não pedido de graça. */
export const emReais = (valor: number | null | undefined) =>
  valor == null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

/** "13/10" — a rota é de hoje ou de ontem, o ano só ocupa espaço. */
export const diaCurto = (iso: string | null) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '';

const MENSAGEM_DE_REDE = 'Não conseguimos falar com o sistema agora. Tente de novo.';

/**
 * A fila é tudo que espera entrega. Vem com a dívida no topo — quem voltou sem
 * entregar antes —, e essa ordem o banco já resolve; a tela não reordena.
 */
export const useFilaDeEntregas = (empresaId: string | null) => {
  const [fila, setFila] = useState<EntregaDaFila[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setFila([]);
      return;
    }
    setCarregando(true);
    setErro(null);
    const { data, error } = await supabase.rpc('entrega_fila', { p_empresa_id: empresaId });
    setCarregando(false);
    if (error) {
      setErro(error.message);
      setFila([]);
      return;
    }
    setFila((data as unknown as EntregaDaFila[]) ?? []);
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { fila, carregando, erro, recarregar: carregar };
};

/**
 * A rota do dia, recarregada a cada 30s.
 *
 * Não é realtime de propósito: o client.ts desliga o websocket do Supabase pra
 * economizar egress, e a loja quer saber que a entrega saiu — não ver o dedo do
 * entregador tocando o botão.
 */
const SEGUNDOS_ENTRE_RECARGAS = 30;

export const useRotaDoDia = (empresaId: string | null, data: string) => {
  const [rota, setRota] = useState<RotaDoDia | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setRota(null);
      return;
    }
    setErro(null);
    const { data: res, error } = await supabase.rpc('entrega_rota_do_dia', {
      p_empresa_id: empresaId,
      p_data: data,
    });
    if (error) {
      setErro(error.message);
      return;
    }
    setRota(res as unknown as RotaDoDia);
  }, [empresaId, data]);

  // Só a primeira carga mostra spinner. As recargas de 30s são silenciosas —
  // tela que pisca sozinha a cada meio minuto ninguém deixa aberta.
  useEffect(() => {
    let vivo = true;
    const primeira = async () => {
      setCarregando(true);
      await carregar();
      if (vivo) setCarregando(false);
    };
    primeira();
    const t = setInterval(carregar, SEGUNDOS_ENTRE_RECARGAS * 1000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [carregar]);

  const montarRota = async (entregaIds: string[]): Promise<ResultadoRpc> => {
    if (!empresaId) return { ok: false, mensagem: 'Nenhuma empresa selecionada.' };
    const { data: res, error } = await supabase.rpc('entrega_montar_rota', {
      p_empresa_id: empresaId,
      p_data: data,
      p_entrega_ids: entregaIds,
    });
    if (error) return { ok: false, mensagem: MENSAGEM_DE_REDE };
    const r = res as unknown as ResultadoRpc;
    if (r?.ok) await carregar();
    return r;
  };

  const inverterRota = async (): Promise<ResultadoRpc> => {
    if (!rota?.rota_id) return { ok: false, mensagem: 'Monte a rota antes de invertê-la.' };
    const { data: res, error } = await supabase.rpc('entrega_inverter_rota', {
      p_rota_id: rota.rota_id,
    });
    if (error) return { ok: false, mensagem: MENSAGEM_DE_REDE };
    const r = res as unknown as ResultadoRpc;
    if (r?.ok) await carregar();
    return r;
  };

  /**
   * Reordena otimista: a lista muda na tela antes do banco responder, senão
   * arrastar parece travado. Se o banco recusar, o próximo carregar traz a
   * ordem de verdade.
   *
   * A ordem gravada é sempre crescente. Quando a rota está invertida, o que
   * está no topo da tela é o último na ordem canônica — por isso a conta vira.
   * Errar isso faria o arrasto se desfazer ao inverter.
   */
  const moverParadas = async (novaOrdem: ParadaDaRota[]): Promise<ResultadoRpc> => {
    setRota((atual) => (atual ? { ...atual, paradas: novaOrdem } : atual));

    const invertida = Boolean(rota?.invertida);
    const total = novaOrdem.length;
    const falhou: string[] = [];

    for (let i = 0; i < total; i += 1) {
      const posicao = invertida ? total - i : i + 1;
      const { data: res, error } = await supabase.rpc('entrega_mover_parada', {
        p_parada_id: novaOrdem[i].parada_id,
        p_nova_ordem: posicao * 10,
      });
      const r = res as unknown as ResultadoRpc | null;
      if (error || r?.ok === false) falhou.push(novaOrdem[i].cliente_nome);
    }

    await carregar();
    if (falhou.length > 0) {
      return { ok: false, mensagem: `Não conseguimos guardar a ordem de ${falhou[0]}.` };
    }
    return { ok: true };
  };

  const importarLote = async (linhas: unknown[]): Promise<ResultadoImportacao> => {
    if (!empresaId) return { ok: false, mensagem: 'Nenhuma empresa selecionada.' };
    const { data: res, error } = await supabase.rpc('entrega_importar_lote', {
      p_empresa_id: empresaId,
      p_linhas: linhas as never,
    });
    if (error) return { ok: false, mensagem: error.message };
    return res as unknown as ResultadoImportacao;
  };

  return {
    rota,
    carregando,
    erro,
    recarregar: carregar,
    montarRota,
    inverterRota,
    moverParadas,
    importarLote,
  };
};

export interface BairroDeEntrega {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

/**
 * Os bairros em ordem geográfica. A ordem é a rota: se um bairro estiver no
 * lugar errado, a rota sai errada todo dia e ninguém percebe de imediato — por
 * isso existe tela pra conferir, e não só um insert na migration.
 */
export const useBairrosDeEntrega = (empresaId: string | null) => {
  const [bairros, setBairros] = useState<BairroDeEntrega[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setBairros([]);
      return;
    }
    setCarregando(true);
    const { data } = await supabase
      .from('entrega_bairros')
      .select('id, nome, ordem, ativo')
      .eq('empresa_id', empresaId)
      .order('ordem', { ascending: true });
    setCarregando(false);
    setBairros((data as BairroDeEntrega[]) ?? []);
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Grava em passos de 10, pra caber bairro novo no meio depois sem renumerar. */
  const gravarOrdem = async (novaOrdem: BairroDeEntrega[]) => {
    setBairros(novaOrdem);
    for (let i = 0; i < novaOrdem.length; i += 1) {
      await supabase
        .from('entrega_bairros')
        .update({ ordem: (i + 1) * 10 })
        .eq('id', novaOrdem[i].id);
    }
    await carregar();
  };

  const adicionarBairro = async (nome: string): Promise<ResultadoRpc> => {
    if (!empresaId) return { ok: false, mensagem: 'Nenhuma empresa selecionada.' };
    const limpo = nome.trim();
    if (!limpo) return { ok: false, mensagem: 'Escreva o nome do bairro.' };

    const fim = (bairros[bairros.length - 1]?.ordem ?? 0) + 10;
    const { error } = await supabase
      .from('entrega_bairros')
      .insert({ empresa_id: empresaId, nome: limpo, ordem: fim });

    if (error) {
      const repetido = error.code === '23505' || error.message.includes('duplicate');
      return { ok: false, mensagem: repetido ? `${limpo} já está na lista.` : MENSAGEM_DE_REDE };
    }
    await carregar();
    return { ok: true, mensagem: `${limpo} entrou no fim da lista. Arraste pro lugar certo.` };
  };

  const alternarAtivo = async (bairro: BairroDeEntrega) => {
    await supabase.from('entrega_bairros').update({ ativo: !bairro.ativo }).eq('id', bairro.id);
    await carregar();
  };

  return { bairros, carregando, recarregar: carregar, gravarOrdem, adicionarBairro, alternarAtivo };
};

export interface ParadaDoEntregador {
  entrega_id: string;
  ordem: number;
  documento: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  bairro: string | null;
  endereco: string | null;
  entregar_em: string | null;
  itens: ItemEntrega[];
  situacao: EntregaSituacao;
}

export interface MinhaRota extends ResultadoRpc {
  nome?: string;
  rota_id?: string;
  invertida?: boolean;
  paradas: ParadaDoEntregador[];
}

export interface ResultadoRegistro extends ResultadoRpc {
  evento_id?: string;
  situacao?: EntregaSituacao;
  nome?: string;
}

/**
 * A coordenada é do aparelho, então é declarada — não provada. E não pode
 * travar o trabalho: se o GPS demorar ou a pessoa negar, registra sem ela.
 * Hora e rede continuam vindo do servidor, e é isso que prende o registro ao
 * mundo real.
 */
const SEGUNDOS_ESPERANDO_GPS = 8;

/**
 * O timeout do getCurrentPosition não vale enquanto o navegador está mostrando
 * o pedido de permissão: se ninguém tocar naquela bolinha, nenhum dos dois
 * callbacks acontece, e a tela fica em "Registrando..." pra sempre. Na rua isso
 * é a entrega sumindo sem ninguém perceber. Por isso a contagem é nossa, por
 * fora, e vale mesmo que o navegador nunca responda.
 */
const pegarLocalizacao = (): Promise<GeolocationCoordinates | null> =>
  new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }

    let respondido = false;
    const encerrar = (coords: GeolocationCoordinates | null) => {
      if (respondido) return;
      respondido = true;
      resolve(coords);
    };

    const desistir = setTimeout(() => encerrar(null), SEGUNDOS_ESPERANDO_GPS * 1000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(desistir);
        encerrar(pos.coords);
      },
      () => {
        clearTimeout(desistir);
        encerrar(null);
      },
      { enableHighAccuracy: true, timeout: SEGUNDOS_ESPERANDO_GPS * 1000, maximumAge: 30000 }
    );
  });

/**
 * A rota do entregador. Ele chega pelo PIN, como já bate ponto: não tem conta
 * de painel e não deve ter. O PIN fica em memória depois da primeira vez — ele
 * não vai digitar quatro dígitos doze vezes na rua.
 */
export const useMinhaRota = (empresaId: string | null) => {
  const [pin, setPin] = useState<string | null>(null);
  const [rota, setRota] = useState<MinhaRota | null>(null);
  const [carregando, setCarregando] = useState(false);

  const buscarRota = useCallback(
    async (pinDigitado: string): Promise<MinhaRota> => {
      if (!empresaId) return { ok: false, mensagem: 'Loja não configurada.', paradas: [] };
      setCarregando(true);
      const { data, error } = await supabase.rpc('entrega_minha_rota', {
        p_pin: pinDigitado,
        p_empresa_id: empresaId,
      });
      setCarregando(false);
      if (error) return { ok: false, mensagem: MENSAGEM_DE_REDE, paradas: [] };

      const r = data as unknown as MinhaRota;
      if (r?.ok) {
        setPin(pinDigitado);
        setRota({ ...r, paradas: r.paradas ?? [] });
      }
      return r;
    },
    [empresaId]
  );

  const recarregar = useCallback(async () => {
    if (pin) await buscarRota(pin);
  }, [pin, buscarRota]);

  const registrar = async (
    entregaId: string,
    tipo: EntregaEventoTipo,
    extra: { motivo?: EntregaMotivo; motivoTexto?: string; quemRecebeu?: string } = {}
  ): Promise<ResultadoRegistro> => {
    if (!pin) return { ok: false, mensagem: 'Digite seu PIN de novo.' };

    const coords = await pegarLocalizacao();
    const { data, error } = await supabase.rpc('entrega_registrar', {
      p_pin: pin,
      p_entrega_id: entregaId,
      p_tipo: tipo,
      p_motivo: extra.motivo,
      p_motivo_texto: extra.motivoTexto,
      p_quem_recebeu: extra.quemRecebeu,
      p_lat: coords?.latitude,
      p_lng: coords?.longitude,
      p_precisao_m: coords?.accuracy,
    });

    if (error) return { ok: false, mensagem: MENSAGEM_DE_REDE };
    const r = data as unknown as ResultadoRegistro;
    if (r?.ok) await recarregar();
    return r;
  };

  const sair = () => {
    setPin(null);
    setRota(null);
  };

  return { pin, rota, carregando, buscarRota, recarregar, registrar, sair };
};

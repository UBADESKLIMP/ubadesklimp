import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MarcacaoTipo, ResultadoBatida } from '@/hooks/usePontoQuiosque';

/**
 * Identidade do aparelho. Fica no navegador do celular da pessoa e é o que
 * distingue "o meu celular" de "o celular do colega" (PRD 4.3). O banco só
 * guarda o hash — aqui nunca vai nome, número nem nada do aparelho.
 */
const CHAVE_DISPOSITIVO = 'ubadesklimp.ponto.dispositivo';

export const idDoDispositivo = (): string => {
  try {
    const guardado = localStorage.getItem(CHAVE_DISPOSITIVO);
    if (guardado) return guardado;
    const novo = crypto.randomUUID();
    localStorage.setItem(CHAVE_DISPOSITIVO, novo);
    return novo;
  } catch {
    // Navegador sem storage: o aparelho muda de identidade a cada visita e
    // nunca fica aprovado. É o lado seguro — melhor não bater do que bater
    // como se fosse outro.
    return crypto.randomUUID();
  }
};

export interface PessoaDoQr {
  id: string;
  nome: string;
}

export interface ContextoQr {
  ok: boolean;
  motivo?: string;
  mensagem?: string;
  local?: string;
  local_id?: string;
  empresa_id?: string;
  rede_ok?: boolean;
  marcacoes?: MarcacaoTipo[];
  funcionarios?: PessoaDoQr[];
}

export type StatusDispositivo = 'novo' | 'pendente' | 'aprovado' | 'revogado';

export const usePontoQr = (token: string | undefined) => {
  const [contexto, setContexto] = useState<ContextoQr | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!token) {
      setContexto({ ok: false, motivo: 'token_qr_invalido' });
      setCarregando(false);
      return;
    }
    const { data, error } = await supabase.rpc('ponto_qr_contexto', { p_qr_token: token });
    setCarregando(false);
    if (error) {
      setContexto({ ok: false, motivo: 'erro', mensagem: 'Não conseguimos carregar agora.' });
      return;
    }
    setContexto(data as unknown as ContextoQr);
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const statusDoDispositivo = async (funcionarioId: string): Promise<StatusDispositivo> => {
    const { data, error } = await supabase.rpc('ponto_status_dispositivo', {
      p_funcionario_id: funcionarioId,
      p_device_id: idDoDispositivo(),
    });
    if (error) return 'novo';
    return ((data as unknown as { status?: string })?.status ?? 'novo') as StatusDispositivo;
  };

  const registrarDispositivo = async (funcionarioId: string, pin: string, apelido?: string) => {
    const { data, error } = await supabase.rpc('ponto_registrar_dispositivo', {
      p_funcionario_id: funcionarioId,
      p_pin: pin,
      p_device_id: idDoDispositivo(),
      p_apelido: apelido ?? undefined,
    });
    if (error) return { ok: false, mensagem: 'Não conseguimos registrar agora. Tente de novo.' };
    return data as unknown as { ok: boolean; status?: StatusDispositivo; mensagem?: string };
  };

  const bater = async (
    funcionarioId: string,
    pin: string,
    tipo?: MarcacaoTipo
  ): Promise<ResultadoBatida> => {
    if (!token) return { ok: false, mensagem: 'Este QR não é válido.' };
    const { data, error } = await supabase.rpc('ponto_registrar', {
      p_funcionario_id: funcionarioId,
      p_pin: pin,
      p_tipo: tipo ?? undefined,
      p_qr_token: token,
      p_device_id: idDoDispositivo(),
    });
    if (error) {
      return { ok: false, mensagem: 'Não conseguimos registrar agora. Tente de novo.' };
    }
    return data as unknown as ResultadoBatida;
  };

  return { contexto, carregando, recarregar: carregar, statusDoDispositivo, registrarDispositivo, bater };
};

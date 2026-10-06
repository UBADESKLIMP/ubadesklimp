import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ProblemaDoDia = 'falta' | 'sem_saida' | 'sem_retorno' | 'sem_almoco' | null;

/** Furo trava o fechamento; aviso só precisa ser visto. */
export type GrauDoDia = 'furo' | 'aviso' | null;

export interface DiaDoEspelho {
  data: string;
  previsto: boolean;
  fora_da_escala: boolean;
  /** Qual escala valeu neste dia — no sábado é o turno da pessoa. */
  escala_nome: string | null;
  escala_entrada: string | null;
  escala_saida: string | null;
  /** Minutos previstos neste dia; 0 quando o dia não é de trabalho. */
  jornada_min: number;
  entrada: string | null;
  saida_almoco: string | null;
  retorno_almoco: string | null;
  saida: string | null;
  extra_entrada: string | null;
  extra_saida: string | null;
  /** Nulo quando o dia não fechou: falta o dado, não a hora. */
  total_min: number | null;
  saldo_min: number | null;
  atraso_min: number | null;
  problema: ProblemaDoDia;
  grau: GrauDoDia;
}

export interface TotaisDoMes {
  trabalhado_min: number;
  previsto_min: number;
  saldo_min: number;
  dias_trabalhados: number;
  furos: number;
  avisos: number;
  faltas: number;
  dias_fora_da_escala: number;
  min_fora_da_escala: number;
  atrasos: number;
}

export interface PessoaDoEspelho {
  funcionario_id: string;
  nome: string;
  matricula: string | null;
  cargo: string | null;
  cpf: string | null;
  pis: string | null;
  endereco: string | null;
  jornada: string | null;
  jornada_min: number;
  dias: DiaDoEspelho[];
  totais: TotaisDoMes;
}

export interface Espelho {
  empresa: { razao_social: string; cnpj: string | null } | null;
  mes: string;
  pessoas: PessoaDoEspelho[];
}

/** Minutos para "HH:MM". 487 vira "08:07". */
export const hhmm = (min: number) => {
  const m = Math.abs(Math.round(min));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Saldo com sinal, que é como se lê um banco de horas. */
export const saldoHhmm = (min: number) => (min < 0 ? '−' : '+') + hhmm(min);

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** O banco devolve o dia em inglês; o documento é em português. */
export const diaDaSemana = (iso: string) => DIAS[new Date(`${iso}T12:00:00`).getDay()];
export const diaDoMes = (iso: string) => iso.slice(8, 10);
export const mesPorExtenso = (ym: string) => {
  const [a, m] = ym.split('-');
  return `${MESES[Number(m) - 1]} de ${a}`;
};

export const PROBLEMA_LABEL: Record<Exclude<ProblemaDoDia, null>, string> = {
  falta: 'Faltou',
  sem_saida: 'Sem saída',
  sem_retorno: 'Sem volta do almoço',
  sem_almoco: 'Sem almoço',
};

/** O mês anterior, que é o que se fecha e manda pra contabilidade. */
export const mesPassado = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const usePontoEspelho = (
  empresaId: string | null,
  mes: string,
  funcionarioId: string | null
) => {
  const [espelho, setEspelho] = useState<Espelho | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setEspelho(null);
      return;
    }
    setCarregando(true);
    setErro(null);
    const { data, error } = await supabase.rpc('ponto_espelho_mensal', {
      p_empresa_id: empresaId,
      p_mes: `${mes}-01`,
      p_funcionario_id: funcionarioId ?? undefined,
    });
    setCarregando(false);
    if (error) {
      setErro(error.message);
      setEspelho(null);
      return;
    }
    setEspelho(data as unknown as Espelho);
  }, [empresaId, mes, funcionarioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { espelho, carregando, erro, recarregar: carregar };
};

export interface RodizioSemana {
  data: string;
  quem: { nome: string; escala: string | null; entrada: string | null }[];
}

export interface Rodizio {
  id: string;
  nome: string;
  pessoas: string[];
  semanas: RodizioSemana[];
}

/**
 * Revezamento de turno. É calculado a partir de uma data âncora, então não
 * precisa de manutenção semanal — mas por isso mesmo precisa ficar à vista: se
 * começar na semana errada, inverte tudo em silêncio.
 */
export const useRodizios = (empresaId: string | null, mes: string) => {
  const [rodizios, setRodizios] = useState<Rodizio[]>([]);

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setRodizios([]);
      return;
    }
    const { data } = await supabase.rpc('equipe_rodizios_do_mes', {
      p_empresa_id: empresaId,
      p_mes: `${mes}-01`,
    });
    setRodizios((data as unknown as Rodizio[]) ?? []);
  }, [empresaId, mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const trocarSemanas = async (rodizioId: string) => {
    await supabase.rpc('equipe_rodizio_trocar_semanas', { p_rodizio_id: rodizioId });
    await carregar();
  };

  return { rodizios, trocarSemanas, recarregar: carregar };
};

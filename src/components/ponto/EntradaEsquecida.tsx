import { useState } from 'react';
import { ArrowLeft, Loader2, LogIn, UtensilsCrossed } from 'lucide-react';

interface Props {
  nome?: string;
  /** Horário de entrada da escala dele, usado como ponto de partida na resposta. */
  escalaEntrada?: string;
  agora?: string;
  /** "Estou chegando": grava a entrada agora. */
  onChegando: () => Promise<void>;
  /** "Estou saindo para o almoço": grava a saída e abre o pedido da entrada. Devolve o erro, se houver. */
  onAlmoco: (horaChegada: string) => Promise<string | null>;
  onVoltar: () => void;
}

/**
 * Primeira batida do dia, mas já passou da hora de chegar: pode ser a saída do
 * almoço de quem esqueceu de bater a entrada de manhã. Em vez de gravar "Entrada
 * às 12:00" calado, pergunta. Quem está saindo para o almoço diz a que horas
 * chegou, e isso já vai no pedido de ajuste para o gestor.
 */
const EntradaEsquecida = ({ nome, escalaEntrada, agora, onChegando, onAlmoco, onVoltar }: Props) => {
  const [passo, setPasso] = useState<'pergunta' | 'hora'>('pergunta');
  const [hora, setHora] = useState(escalaEntrada ?? '');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const chegando = async () => {
    setEnviando(true);
    await onChegando();
    setEnviando(false);
  };

  const confirmarAlmoco = async () => {
    setEnviando(true);
    setErro(null);
    const e = await onAlmoco(hora);
    setEnviando(false);
    if (e) setErro(e);
  };

  if (passo === 'hora') {
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto px-5 pb-6 pt-2 text-white">
        <div className="w-full max-w-xl space-y-5">
          <div className="text-center">
            <p className="text-xl font-heading">A que horas você chegou hoje?</p>
            <p className="mt-1 text-sm text-white/70">
              Pode ser aproximado. Isso vai para o gestor junto com o pedido para registrar a sua entrada.
            </p>
          </div>

          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="h-16 w-full rounded-2xl border border-white/25 bg-white/10 px-5 text-center text-3xl font-semibold text-white [color-scheme:dark]"
            autoFocus
          />

          <p className="text-center text-sm text-white/65">
            Agora vamos registrar a sua <span className="font-semibold text-white">saída para o almoço</span>
            {agora ? ` às ${agora}` : ''}.
          </p>

          {erro && <p className="text-center text-sm font-medium text-[#FFB4AA]">{erro}</p>}

          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={() => {
                setErro(null);
                setPasso('pergunta');
              }}
              disabled={enviando}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 text-base font-medium"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <button
              type="button"
              onClick={confirmarAlmoco}
              disabled={enviando || !/^\d{1,2}:\d{2}$/.test(hora)}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-base font-semibold text-[#0b1020] transition active:scale-[0.99] disabled:bg-white/10 disabled:text-white/35"
            >
              {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar saída para o almoço
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto px-5 pb-6 pt-2 text-white">
      <div className="w-full max-w-xl space-y-5">
        <div className="text-center">
          {nome && <p className="text-sm text-white/70">{nome}</p>}
          <p className="text-2xl font-semibold">Você ainda não bateu a entrada hoje</p>
          <p className="mt-1 text-sm text-white/70">
            O que você está fazendo agora{agora ? ` (${agora})` : ''}?
          </p>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={chegando}
            disabled={enviando}
            className="flex min-h-20 items-center gap-4 rounded-2xl border border-white/25 bg-white/10 px-5 text-left text-lg font-medium transition hover:bg-white/15 active:scale-[0.98] disabled:opacity-50"
          >
            <LogIn className="h-6 w-6 shrink-0" />
            Estou chegando agora
          </button>
          <button
            type="button"
            onClick={() => setPasso('hora')}
            disabled={enviando}
            className="flex min-h-20 items-center gap-4 rounded-2xl border border-white/25 bg-white/10 px-5 text-left text-lg font-medium transition hover:bg-white/15 active:scale-[0.98] disabled:opacity-50"
          >
            <UtensilsCrossed className="h-6 w-6 shrink-0" />
            <span>
              Estou saindo para o almoço
              <span className="block text-sm font-normal text-white/70">Esqueci de bater a entrada de manhã</span>
            </span>
          </button>
        </div>

        {enviando && (
          <p className="flex items-center justify-center gap-2 text-sm text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" /> Registrando...
          </p>
        )}

        <button type="button" onClick={onVoltar} className="w-full py-2 text-center text-sm text-white/70 hover:text-white">
          Cancelar
        </button>
      </div>
    </main>
  );
};

export default EntradaEsquecida;

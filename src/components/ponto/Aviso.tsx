import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEGUNDOS = 5;

interface Props {
  ok: boolean;
  /** Linha grande: hora da batida, quantidade de entradas, nome do produto. */
  destaque?: string;
  /** Linha logo abaixo do destaque. */
  detalhe?: string;
  /** Texto corrido, usado quando não há destaque (erro, aviso). */
  mensagem?: string;
  /** Código curto do hash, só na batida. */
  codigo?: string;
  onFim: () => void;
}

/**
 * Tela cheia verde ou vermelha, legível de longe e por quem está de passagem.
 * É a mesma resposta pra bater ponto, abrir a loja e reportar faltante — uma
 * linguagem só pro balcão.
 */
const Aviso = ({ ok, destaque, detalhe, mensagem, codigo, onFim }: Props) => {
  const [restante, setRestante] = useState(SEGUNDOS);

  useEffect(() => {
    if (restante <= 0) {
      onFim();
      return;
    }
    const t = setTimeout(() => setRestante((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [restante, onFim]);

  useEffect(() => {
    // vibração curta confirma sem a pessoa precisar ler (PRD seção 6)
    if (ok && 'vibrate' in navigator) navigator.vibrate?.(120);
  }, [ok]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center',
        ok ? 'bg-[#2F9E44] text-white' : 'bg-[#C0392B] text-white'
      )}
      onClick={onFim}
    >
      {ok ? <Check className="h-20 w-20 mb-4" /> : <X className="h-20 w-20 mb-4" />}

      {destaque ? (
        <>
          <p className="font-mono text-6xl sm:text-7xl font-bold tabular-nums">{destaque}</p>
          {detalhe && <p className="text-2xl mt-3">{detalhe}</p>}
          {mensagem && <p className="text-lg mt-4 opacity-90 max-w-sm">{mensagem}</p>}
          {codigo && <p className="text-sm mt-6 opacity-80 font-mono">comprovante {codigo}</p>}
        </>
      ) : (
        <p className="text-2xl max-w-md leading-snug">{mensagem}</p>
      )}

      <p className="text-sm opacity-70 mt-8">Toque para voltar · {restante}s</p>
    </div>
  );
};

export default Aviso;

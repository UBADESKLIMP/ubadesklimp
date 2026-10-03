import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEGUNDOS = 5;

interface Props {
  ok: boolean;
  /** Quem bateu. Só aparece depois do PIN conferir — nunca antes. */
  nome?: string;
  /** Linha grande: hora da batida, quantidade de entradas, "Anotado". */
  destaque?: string;
  detalhe?: string;
  mensagem?: string;
  codigo?: string;
  onFim: () => void;
}

/**
 * Tela cheia verde ou vermelha, legível do outro lado do balcão. É a mesma
 * resposta pra bater ponto, abrir a loja e reportar faltante — uma linguagem
 * só, pra ninguém precisar aprender duas.
 */
const Aviso = ({ ok, nome, destaque, detalhe, mensagem, codigo, onFim }: Props) => {
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
        'fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center',
        ok ? 'bg-[#1F7A4C] text-white' : 'bg-[#B5362A] text-white'
      )}
      onClick={onFim}
    >
      <div
        className={cn(
          'h-20 w-20 rounded-full flex items-center justify-center mb-7',
          ok ? 'bg-white/15' : 'bg-white/15'
        )}
      >
        {ok ? <Check className="h-11 w-11" strokeWidth={2.5} /> : <X className="h-11 w-11" strokeWidth={2.5} />}
      </div>

      {nome && (
        <p className="text-2xl sm:text-3xl font-heading font-medium mb-2 opacity-95">{nome}</p>
      )}

      {destaque ? (
        <>
          <p className="font-mono text-[5.5rem] sm:text-[7rem] leading-none font-bold tabular-nums tracking-tight">
            {destaque}
          </p>
          {detalhe && <p className="text-2xl mt-4 opacity-90">{detalhe}</p>}
          {mensagem && <p className="text-lg mt-5 opacity-80 max-w-sm">{mensagem}</p>}
          {codigo && (
            <p className="text-xs mt-8 opacity-60 font-mono tracking-widest uppercase">
              comprovante {codigo}
            </p>
          )}
        </>
      ) : (
        <p className="text-2xl sm:text-3xl max-w-md leading-snug">{mensagem}</p>
      )}

      <p className="text-sm opacity-50 mt-10">Toque para voltar · {restante}s</p>
    </div>
  );
};

export default Aviso;


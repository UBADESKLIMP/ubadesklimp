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

  // Qualquer tecla também volta (quem usa o teclado do PC não precisa pegar o
  // mouse). Pausa curta no começo e sem repetição, para a própria tecla que
  // acabou de confirmar não fechar a tela na mesma hora.
  useEffect(() => {
    const abriuEm = Date.now();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.repeat || Date.now() - abriuEm < 500) return;
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
      e.preventDefault();
      onFim();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFim]);

  useEffect(() => {
    // vibração curta confirma sem a pessoa precisar ler (PRD seção 6)
    if (ok && 'vibrate' in navigator) navigator.vibrate?.(120);
  }, [ok]);

  return (
    <div
      className={cn(
        'aviso-revelar fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center',
        ok ? 'bg-[#1F7A4C] text-white' : 'bg-[#B5362A] text-white'
      )}
      onClick={onFim}
    >
      {/* O círculo cresce do centro, o ícone salta e um anel se espalha: a
          resposta aparece no centro do olhar, não "troca de tela" de repente. */}
      <div className="relative mb-7 flex h-24 w-24 items-center justify-center">
        <span className="aviso-anel absolute inset-0 rounded-full border-4 border-white/60" />
        <div
          className={cn(
            'aviso-pop flex h-24 w-24 items-center justify-center rounded-full bg-white/15',
            !ok && 'aviso-nao'
          )}
        >
          {ok ? <Check className="h-12 w-12" strokeWidth={2.75} /> : <X className="h-12 w-12" strokeWidth={2.75} />}
        </div>
      </div>

      {nome && (
        <p className="aviso-sobe text-2xl sm:text-3xl font-heading font-medium mb-2 opacity-95" style={{ animationDelay: '0.25s' }}>
          {nome}
        </p>
      )}

      {destaque ? (
        <>
          <p
            className="aviso-sobe font-mono text-[5.5rem] sm:text-[7rem] leading-none font-bold tabular-nums tracking-tight"
            style={{ animationDelay: '0.35s' }}
          >
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

      <p className="aviso-sobe text-sm opacity-60 mt-10" style={{ animationDelay: '0.6s' }}>
        Toque ou aperte qualquer tecla para voltar · {restante}s
      </p>
    </div>
  );
};

export default Aviso;


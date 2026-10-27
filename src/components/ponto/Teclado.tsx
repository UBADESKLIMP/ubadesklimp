import { useEffect, useRef, useState } from 'react';
import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  valor: string;
  onChange: (v: string) => void;
  onConfirmar: () => void;
  confirmando?: boolean;
  tamanho?: number;
  /** Azul da loja (ponto) ou âmbar (abrir loja), pra diferenciar o que está em jogo. */
  tom?: 'ponto' | 'loja';
  /** Quando muda pra um texto, o teclado chacoalha: é o "PIN errado" sem precisar ler nada. */
  erro?: string | null;
}

// O painel tem o próprio fundo escuro com degradê da cor do tom, então o
// teclado fica igual em qualquer tela (clara ou escura) onde for usado.
const FUNDO = {
  ponto: 'radial-gradient(120% 75% at 50% 0%, color-mix(in srgb, hsl(var(--primary)) 62%, #0b1020), #0b1020 72%)',
  loja: 'radial-gradient(120% 75% at 50% 0%, color-mix(in srgb, #B8860B 62%, #0b1020), #0b1020 72%)',
};

/**
 * Teclado do balcão e do celular do entregador. Teclas grandes porque se usa
 * em pé, de passagem. Entra sozinho no último número (sem botão de confirmar)
 * e aceita o teclado numérico do PC.
 */
const Teclado = ({ valor, onChange, onConfirmar, confirmando, tamanho = 4, tom = 'ponto', erro }: Props) => {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const completo = valor.length >= tamanho;
  const [chacoalhando, setChacoalhando] = useState(false);

  // A função de confirmar muda a cada render da tela; a ref evita reiniciar o
  // temporizador toda vez.
  const confirmarRef = useRef(onConfirmar);
  confirmarRef.current = onConfirmar;

  const digitar = (t: string) => {
    if (valor.length < tamanho) onChange(valor + t);
  };

  // Último número digitado confirma sozinho, com uma pausa curta pra o último
  // ponto encher antes da tela mudar.
  useEffect(() => {
    if (!completo || confirmando) return;
    const t = setTimeout(() => confirmarRef.current(), 180);
    return () => clearTimeout(t);
  }, [completo, confirmando, valor]);

  useEffect(() => {
    if (!erro) return;
    setChacoalhando(true);
    const t = setTimeout(() => setChacoalhando(false), 420);
    return () => clearTimeout(t);
  }, [erro]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      // Não sequestrar o teclado quando a pessoa está num campo de texto
      // (busca de produto, apelido do celular).
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA')) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        digitar(e.key);
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        onChange(valor.slice(0, -1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (completo && !confirmando) onConfirmar();
        return;
      }
      // Esc não limpa aqui: quem cuida dele é a tela, que usa Esc pra
      // voltar ao ponto de qualquer lugar do quiosque.
    };

    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [valor, completo, confirmando, onChange, onConfirmar]);

  const tecla =
    'h-[4.25rem] w-full rounded-full border border-white/20 bg-white/10 text-3xl font-medium text-white ' +
    'backdrop-blur-sm transition active:scale-[0.93] active:bg-white/25 hover:bg-white/15 ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-white';

  return (
    <div
      className="mx-auto w-full max-w-[19rem] rounded-[2rem] px-6 pb-6 pt-8 shadow-xl"
      style={{ background: FUNDO[tom] }}
    >
      <div
        className={cn('mb-7 flex justify-center gap-4', chacoalhando && 'animate-[teclado-chacoalha_0.4s]')}
        aria-label="PIN digitado"
      >
        {Array.from({ length: tamanho }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-3.5 w-3.5 rounded-full border-2 transition-all duration-150',
              valor.length > i ? 'scale-110 border-white bg-white' : 'border-white/55 bg-transparent'
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {teclas.map((t) => (
          <button key={t} type="button" onClick={() => digitar(t)} className={cn(tecla, 'font-mono')}>
            {t}
          </button>
        ))}
        <span aria-hidden />
        <button type="button" onClick={() => digitar('0')} className={cn(tecla, 'font-mono')}>
          0
        </button>
        <button
          type="button"
          onClick={() => onChange(valor.slice(0, -1))}
          className={cn(tecla, 'flex items-center justify-center border-transparent bg-transparent text-white/75')}
          aria-label="Apagar"
        >
          <Delete className="h-7 w-7" />
        </button>
      </div>

      <p className="mt-5 text-center text-xs text-white/60">
        Entra sozinho no último número · dá para usar o teclado do computador
      </p>
    </div>
  );
};

export default Teclado;

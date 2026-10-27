import { useEffect, useRef, useState } from 'react';
import { Check, Delete } from 'lucide-react';
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
  /**
   * Sem o painel escuro em volta e com teclas maiores: é para telas que já são
   * inteiras o degradê (quiosque do ponto, entregador). Quem usa precisa
   * colocar o fundo em volta.
   */
  plano?: boolean;
}

// O painel tem o próprio fundo escuro com degradê da cor do tom, então o
// teclado fica igual em qualquer tela (clara ou escura) onde for usado.
export const FUNDO = {
  ponto: 'radial-gradient(120% 75% at 50% 0%, color-mix(in srgb, hsl(var(--primary)) 62%, #0b1020), #0b1020 72%)',
  loja: 'radial-gradient(120% 75% at 50% 0%, color-mix(in srgb, #B8860B 62%, #0b1020), #0b1020 72%)',
};

/** O degradê da tela inteira (quiosque e entregador): mais claro no alto, escuro embaixo. */
export const FUNDO_TELA =
  'radial-gradient(90% 70% at 30% 0%, color-mix(in srgb, hsl(var(--primary)) 70%, #0b1020), #0b1020 78%)';

/**
 * Teclado do balcão e do celular do entregador. Teclas grandes porque se usa
 * em pé, de passagem. Entra sozinho no último número (sem botão de confirmar)
 * e aceita o teclado numérico do PC.
 */
const Teclado = ({ valor, onChange, onConfirmar, confirmando, tamanho = 4, tom = 'ponto', erro, plano }: Props) => {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const completo = valor.length >= tamanho;
  const [chacoalhando, setChacoalhando] = useState(false);
  // Com mouse a pessoa quer clicar no ✓ (ou Enter); no toque o último número
  // já confirma sozinho. Os dois jeitos existem: o ✓ está sempre na tela.
  const [comMouse, setComMouse] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches
  );
  useEffect(() => {
    const consulta = window.matchMedia?.('(pointer: fine)');
    if (!consulta) return;
    const mudou = () => setComMouse(consulta.matches);
    consulta.addEventListener('change', mudou);
    return () => consulta.removeEventListener('change', mudou);
  }, []);

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
    if (!completo || confirmando || comMouse) return;
    const t = setTimeout(() => confirmarRef.current(), 180);
    return () => clearTimeout(t);
  }, [completo, confirmando, comMouse, valor]);

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
    // Quadrada de propósito: com altura fixa e largura livre a tecla virava uma
    // pílula esticada; assim é sempre um círculo, em celular ou monitor grande.
    'aspect-square w-full rounded-full border border-white/20 bg-white/10 text-3xl md:text-4xl font-medium text-white ' +
    'backdrop-blur-sm transition active:scale-[0.93] active:bg-white/25 hover:bg-white/15 ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-white';

  return (
    <div
      className={cn(
        'mx-auto w-full',
        plano
          ? 'max-w-[min(19rem,calc(72dvh-9rem))] md:max-w-[min(25rem,calc(72dvh-9rem))]'
          : 'max-w-[19rem] rounded-[2rem] px-6 pb-6 pt-8 shadow-xl'
      )}
      style={plano ? undefined : { background: FUNDO[tom] }}
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
        <button
          type="button"
          onClick={() => onChange(valor.slice(0, -1))}
          className={cn(tecla, 'flex items-center justify-center border-transparent bg-transparent text-white/75')}
          aria-label="Apagar"
        >
          <Delete className="h-7 w-7" />
        </button>
        <button type="button" onClick={() => digitar('0')} className={cn(tecla, 'font-mono')}>
          0
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={!completo || confirmando}
          aria-label="Confirmar"
          className={cn(
            tecla,
            'flex items-center justify-center transition-colors',
            completo && !confirmando
              ? 'border-white bg-white text-[hsl(var(--primary))] hover:bg-white active:bg-white/80'
              : 'border-transparent bg-white/10 text-white/35 hover:bg-white/10'
          )}
        >
          <Check className="h-8 w-8" strokeWidth={3} />
        </button>
      </div>

      {!plano && (
        <p className="mt-5 text-center text-xs text-white/60">
          {comMouse
            ? 'Clique no ✓ ou aperte Enter para confirmar'
            : 'Entra sozinho no último número'}
        </p>
      )}
    </div>
  );
};

export default Teclado;

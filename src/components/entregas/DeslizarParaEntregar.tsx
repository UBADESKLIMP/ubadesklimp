import { useRef, useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';

interface Props {
  texto: string;
  onConcluir: () => void;
  carregando?: boolean;
}

/**
 * Arrastar a seta até o fim confirma. Dá menos toque errado do que um botão
 * (no bolso, no carro em movimento) e ainda funciona com Enter ou Espaço para
 * quem não consegue arrastar.
 */
const DeslizarParaEntregar = ({ texto, onConcluir, carregando }: Props) => {
  const trilho = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const arrastando = useRef(false);
  const inicio = useRef(0);

  const MARGEM = 4;
  const maximo = () => {
    const el = trilho.current;
    return el ? el.clientWidth - 46 - MARGEM * 2 : 0;
  };

  const soltar = () => {
    if (!arrastando.current) return;
    arrastando.current = false;
    if (x >= maximo() * 0.8) {
      setX(maximo());
      onConcluir();
    } else {
      setX(0);
    }
  };

  return (
    <div
      ref={trilho}
      className="relative h-14 select-none overflow-hidden rounded-2xl border border-[#1F7A4C]/40 bg-[#1F7A4C]/10"
      style={{ touchAction: 'none' }}
    >
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center pl-11 text-sm font-semibold text-[#1F7A4C]"
        style={{ opacity: Math.max(0.15, 1 - x / Math.max(maximo(), 1)) }}
      >
        {carregando ? 'Registrando...' : texto}
      </span>
      <div
        role="button"
        tabIndex={0}
        aria-label={texto}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!carregando) onConcluir();
          }
        }}
        onPointerDown={(e) => {
          if (carregando) return;
          arrastando.current = true;
          inicio.current = e.clientX - x;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!arrastando.current) return;
          setX(Math.max(0, Math.min(maximo(), e.clientX - inicio.current)));
        }}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        className="absolute flex h-[46px] w-[46px] cursor-grab items-center justify-center rounded-xl bg-[#1F7A4C] text-white active:cursor-grabbing"
        style={{
          top: MARGEM + 1,
          left: MARGEM,
          transform: `translateX(${x}px)`,
          transition: arrastando.current ? 'none' : 'transform 0.2s',
        }}
      >
        {carregando ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-6 w-6" />}
      </div>
    </div>
  );
};

export default DeslizarParaEntregar;

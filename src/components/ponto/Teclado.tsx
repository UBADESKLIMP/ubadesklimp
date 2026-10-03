import { useEffect } from 'react';
import { Delete, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  valor: string;
  onChange: (v: string) => void;
  onConfirmar: () => void;
  confirmando?: boolean;
  tamanho?: number;
  /** Azul da loja (ponto) ou âmbar (abrir loja), pra diferenciar o que está em jogo. */
  tom?: 'ponto' | 'loja';
}

const TOM = {
  ponto: 'bg-primary',
  loja: 'bg-[#B8860B]',
};

/**
 * Teclado do balcão. Teclas grandes porque se usa em pé, de passagem — e
 * aceita o teclado numérico do PC, que é como quem senta ali vai digitar de
 * verdade. Os botões continuam pra quem usa touch.
 */
const Teclado = ({ valor, onChange, onConfirmar, confirmando, tamanho = 4, tom = 'ponto' }: Props) => {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const completo = valor.length >= tamanho;
  const cor = TOM[tom];

  const digitar = (t: string) => {
    if (valor.length < tamanho) onChange(valor + t);
  };

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
      if (e.key === 'Escape') {
        e.preventDefault();
        onChange('');
      }
    };

    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [valor, completo, confirmando, onChange, onConfirmar]);

  const tecla =
    'h-[4.5rem] rounded-2xl bg-white border border-[#DCDFD8] text-3xl font-mono font-semibold ' +
    'text-[#141B1E] shadow-[0_1px_0_rgba(20,27,30,0.06)] ' +
    'hover:border-primary/40 active:scale-[0.97] active:bg-[#ECEEE9] transition';

  return (
    <div className="w-full max-w-[17rem] mx-auto">
      <div className="flex justify-center gap-4 mb-7" aria-label="PIN digitado">
        {Array.from({ length: tamanho }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-3.5 w-3.5 rounded-full transition-all duration-150',
              valor.length > i ? `${cor} scale-110` : 'bg-[#141B1E]/15'
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {teclas.map((t) => (
          <button key={t} type="button" onClick={() => digitar(t)} className={tecla}>
            {t}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(valor.slice(0, -1))}
          className={cn(tecla, 'flex items-center justify-center text-[#55605F]')}
          aria-label="Apagar"
        >
          <Delete className="h-7 w-7" />
        </button>
        <button type="button" onClick={() => digitar('0')} className={tecla}>
          0
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={!completo || confirmando}
          className={cn(
            'h-[4.5rem] rounded-2xl text-white flex items-center justify-center transition',
            'active:scale-[0.97] disabled:bg-[#141B1E]/10 disabled:text-[#141B1E]/30',
            completo && !confirmando ? `${cor} shadow-lg` : ''
          )}
          aria-label="Confirmar"
        >
          <Check className="h-8 w-8" />
        </button>
      </div>

      <p className="text-center text-xs text-[#8A9290] mt-5">
        Dá para digitar no teclado do computador · Enter confirma
      </p>
    </div>
  );
};

export default Teclado;

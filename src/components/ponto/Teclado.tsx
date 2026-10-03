import { Delete, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  valor: string;
  onChange: (v: string) => void;
  onConfirmar: () => void;
  confirmando?: boolean;
  tamanho?: number;
  /** Verde (bater ponto) ou âmbar (abrir loja), pra diferenciar o que está em jogo. */
  tom?: 'ponto' | 'loja';
}

const TOM = {
  ponto: { solido: 'bg-[#0F6B5C]', anel: 'ring-[#0F6B5C]' },
  loja: { solido: 'bg-[#B8860B]', anel: 'ring-[#B8860B]' },
};

/**
 * Teclado do balcão. Teclas grandes porque se usa em pé, de passagem, muitas
 * vezes com a mão ocupada — e porque é o único jeito de entrar no sistema
 * agora que o PIN também diz quem é a pessoa.
 */
const Teclado = ({ valor, onChange, onConfirmar, confirmando, tamanho = 4, tom = 'ponto' }: Props) => {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const completo = valor.length >= tamanho;
  const cor = TOM[tom];

  const digitar = (t: string) => {
    if (valor.length < tamanho) onChange(valor + t);
  };

  const tecla =
    'h-[4.5rem] rounded-2xl bg-white border border-[#DCDFD8] text-3xl font-mono font-semibold ' +
    'text-[#141B1E] shadow-[0_1px_0_rgba(20,27,30,0.06)] ' +
    'hover:border-[#0F6B5C]/40 active:scale-[0.97] active:bg-[#ECEEE9] transition';

  return (
    <div className="w-full max-w-[17rem] mx-auto">
      <div className="flex justify-center gap-4 mb-7" aria-label="PIN digitado">
        {Array.from({ length: tamanho }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-3.5 w-3.5 rounded-full transition-all duration-150',
              valor.length > i ? `${cor.solido} scale-110` : 'bg-[#141B1E]/15'
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
            completo && !confirmando ? `${cor.solido} shadow-lg` : ''
          )}
          aria-label="Confirmar"
        >
          <Check className="h-8 w-8" />
        </button>
      </div>
    </div>
  );
};

export default Teclado;

import { Delete, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  valor: string;
  onChange: (v: string) => void;
  onConfirmar: () => void;
  confirmando?: boolean;
  /** PIN de pessoa tem 4; o de manutenção pode ter até 8. */
  tamanho?: number;
}

/** Teclado grande: o PC da frente é usado em pé e às pressas. */
const TecladoPin = ({ valor, onChange, onConfirmar, confirmando, tamanho = 4 }: Props) => {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const completo = valor.length >= tamanho;

  const digitar = (t: string) => {
    if (valor.length < tamanho) onChange(valor + t);
  };

  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="flex justify-center gap-3 mb-6" aria-label="PIN digitado">
        {Array.from({ length: tamanho }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-5 w-5 rounded-full border-2 transition-colors',
              valor.length > i ? 'bg-primary border-primary' : 'border-muted-foreground/40'
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {teclas.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => digitar(t)}
            className="h-16 rounded-xl border bg-card text-2xl font-mono font-semibold hover:bg-accent active:scale-95 transition"
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(valor.slice(0, -1))}
          className="h-16 rounded-xl border bg-card flex items-center justify-center hover:bg-accent active:scale-95 transition"
          aria-label="Apagar"
        >
          <Delete className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={() => digitar('0')}
          className="h-16 rounded-xl border bg-card text-2xl font-mono font-semibold hover:bg-accent active:scale-95 transition"
        >
          0
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={!completo || confirmando}
          className="h-16 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
          aria-label="Confirmar"
        >
          <Check className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

export default TecladoPin;

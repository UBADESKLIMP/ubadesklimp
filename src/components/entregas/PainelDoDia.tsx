import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, PackageX, PhoneCall, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Indicador {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
  /** Vermelho só quando há algo a resolver; zero nunca assusta. */
  alerta?: boolean;
}

const Tile = ({ icon: Icon, label, value, hint, alerta }: Indicador) => {
  const destacado = alerta && value > 0;
  return (
    <div
      className={cn(
        'rounded-xl border bg-adm-surface p-4 shadow-sm',
        destacado ? 'border-adm-alert-line' : 'border-adm-line'
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-adm-muted">{label}</p>
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            destacado ? 'bg-adm-alert-soft text-adm-alert' : 'bg-adm-accent-soft text-adm-accent'
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p
        className={cn(
          'mt-2 font-mono text-4xl font-semibold tabular-nums',
          destacado ? 'text-adm-alert' : 'text-adm-ink'
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-adm-faint">{hint}</p>
    </div>
  );
};

interface Props {
  naFila: number;
  voltaramSemEntregar: number;
  naRotaHoje: number;
  tresViagensOuMais: number;
  rotaInvertida: boolean;
}

/** Os quatro números do dia, num olhar: o que espera, o que voltou, o que saiu e quem precisa de telefonema. */
const PainelDoDia = ({ naFila, voltaramSemEntregar, naRotaHoje, tresViagensOuMais, rotaInvertida }: Props) => {
  const indicadores: Indicador[] = [
    { icon: PackageX, label: 'Na fila', value: naFila, hint: 'esperando sair' },
    {
      icon: AlertTriangle,
      label: 'Voltou sem entregar',
      value: voltaramSemEntregar,
      hint: voltaramSemEntregar === 0 ? 'nada pendente' : 'vai no topo da rota',
      alerta: true,
    },
    {
      icon: Truck,
      label: 'Na rota de hoje',
      value: naRotaHoje,
      hint: rotaInvertida ? 'do sul para o norte' : 'do norte para o sul',
    },
    {
      icon: PhoneCall,
      label: '3 viagens ou mais',
      value: tresViagensOuMais,
      hint: tresViagensOuMais === 0 ? 'nenhum caso' : 'ligar antes de mandar o carro',
      alerta: true,
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {indicadores.map((indicador) => (
        <Tile key={indicador.label} {...indicador} />
      ))}
    </div>
  );
};

export default PainelDoDia;

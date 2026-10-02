import { useState } from 'react';
import { ArrowLeft, Loader2, DoorOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import TecladoPin from './TecladoPin';
import EscolherPessoa from './EscolherPessoa';
import type {
  FuncionarioDoQuiosque,
  PendenteDaAbertura,
  ResultadoAbertura,
  ResultadoPresentes,
} from '@/hooks/usePontoQuiosque';

interface Props {
  /** Só quem tem a permissão aparece na lista (PRD 4.5, P20). */
  autorizados: FuncionarioDoQuiosque[];
  abrirLoja: (responsavelId: string, pin: string) => Promise<ResultadoAbertura>;
  marcarPresentes: (
    responsavelId: string,
    pin: string,
    funcionarios: string[]
  ) => Promise<ResultadoPresentes>;
  onFim: (ok: boolean, destaque?: string, detalhe?: string, mensagem?: string) => void;
  onVoltar: () => void;
}

type Passo = 'quem' | 'pin' | 'presentes';

const AbrirLoja = ({ autorizados, abrirLoja, marcarPresentes, onFim, onVoltar }: Props) => {
  const [passo, setPasso] = useState<Passo>('quem');
  const [responsavel, setResponsavel] = useState<FuncionarioDoQuiosque | null>(null);
  const [pin, setPin] = useState('');
  const [busca, setBusca] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [hora, setHora] = useState('');
  const [pendentes, setPendentes] = useState<PendenteDaAbertura[]>([]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  // O PIN fica guardado só durante o fluxo: a segunda chamada (marcar os
  // presentes) exige ele de novo e pedir duas vezes na porta da loja, com fila
  // esperando, é o tipo de atrito que faz a equipe abandonar o sistema.
  const confirmarPin = async () => {
    if (!responsavel || pin.length !== 4) return;
    setEnviando(true);
    const r = await abrirLoja(responsavel.id, pin);
    setEnviando(false);

    if (!r.ok) {
      setPin('');
      onFim(false, undefined, undefined, r.mensagem ?? 'Não foi possível abrir a loja.');
      return;
    }

    setHora((r.hora_abertura ?? '').slice(0, 5));
    setPendentes(r.pendentes ?? []);
    setMarcados(new Set());
    setPasso('presentes');
  };

  const alternar = (id: string) =>
    setMarcados((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  const confirmarPresentes = async () => {
    if (!responsavel) return;
    setEnviando(true);
    const r = await marcarPresentes(responsavel.id, pin, [...marcados]);
    setEnviando(false);
    setPin('');

    if (!r.ok) {
      onFim(false, undefined, undefined, r.mensagem ?? 'Não foi possível marcar.');
      return;
    }

    const qtd = r.entradas_registradas ?? 0;
    onFim(
      true,
      String(qtd),
      qtd === 1 ? 'entrada registrada' : 'entradas registradas',
      qtd === 0
        ? 'Ninguém novo foi marcado. Quem já tinha batido continua como estava.'
        : `Às ${(r.hora ?? hora).slice(0, 5)}. Cada um confirma depois, em Meu ponto.`
    );
  };

  if (passo === 'quem') {
    return (
      <EscolherPessoa
        funcionarios={autorizados}
        busca={busca}
        onBusca={setBusca}
        onEscolher={(f) => {
          setResponsavel(f);
          setPin('');
          setPasso('pin');
        }}
        onVoltar={onVoltar}
        vazio="Ninguém com permissão para abrir a loja."
      />
    );
  }

  if (passo === 'pin' && responsavel) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-center">
          <p className="text-2xl font-heading">{responsavel.nome}</p>
          <p className="text-muted-foreground mt-1">Digite seu PIN para abrir a loja</p>
        </div>

        <TecladoPin valor={pin} onChange={setPin} onConfirmar={confirmarPin} confirmando={enviando} />

        <Button variant="ghost" className="h-12" onClick={onVoltar}>
          Cancelar
        </Button>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col p-4 gap-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-12 w-12" onClick={onVoltar}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <p className="text-base font-medium flex items-center gap-2">
            <DoorOpen className="h-4 w-4 shrink-0" />
            Loja aberta às {hora}
          </p>
          <p className="text-sm text-muted-foreground">
            Quem já estava na porta? A lista fecha em 10 minutos.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto grid gap-2 sm:grid-cols-2 content-start">
        {pendentes.length === 0 && (
          <p className="text-muted-foreground p-4">
            Todo mundo já bateu entrada hoje. Nada a marcar.
          </p>
        )}
        {pendentes.map((p) => {
          const marcado = marcados.has(p.funcionario_id);
          return (
            <button
              key={p.funcionario_id}
              type="button"
              onClick={() => alternar(p.funcionario_id)}
              className={cn(
                'h-16 rounded-xl border px-4 flex items-center gap-3 text-left text-lg transition active:scale-[0.99]',
                marcado ? 'border-[#2F9E44] bg-[#2F9E44]/10' : 'bg-card hover:bg-accent'
              )}
            >
              <span
                className={cn(
                  'h-6 w-6 rounded border-2 shrink-0 flex items-center justify-center text-sm font-bold',
                  marcado ? 'border-[#2F9E44] bg-[#2F9E44] text-white' : 'border-muted-foreground/40'
                )}
              >
                {marcado ? '✓' : ''}
              </span>
              {p.nome}
            </button>
          );
        })}
      </div>

      <Button
        className="h-16 text-xl"
        disabled={marcados.size === 0 || enviando}
        onClick={confirmarPresentes}
      >
        {enviando && <Loader2 className="h-5 w-5 animate-spin mr-3" />}
        Registrar entrada de {marcados.size}
      </Button>
    </main>
  );
};

export default AbrirLoja;

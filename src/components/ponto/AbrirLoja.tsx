import { useState } from 'react';
import { Loader2, DoorOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import Teclado from './Teclado';
import type {
  PendenteDaAbertura,
  ResultadoAbertura,
  ResultadoPresentes,
} from '@/hooks/usePontoQuiosque';

interface AvisoAtual {
  ok: boolean;
  nome?: string;
  destaque?: string;
  detalhe?: string;
  mensagem?: string;
}

interface Props {
  abrirLoja: (pin: string) => Promise<ResultadoAbertura>;
  marcarPresentes: (pin: string, funcionarios: string[]) => Promise<ResultadoPresentes>;
  onFim: (a: AvisoAtual) => void;
  onVoltar: () => void;
}

/**
 * Abertura coletiva. Não existe lista de quem pode abrir: o PIN é que diz. Um
 * PIN que não tem a permissão é recusado no banco, então a tela não precisa
 * expor quem são as pessoas autorizadas.
 */
const AbrirLoja = ({ abrirLoja, marcarPresentes, onFim, onVoltar }: Props) => {
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [responsavel, setResponsavel] = useState<string | null>(null);
  const [hora, setHora] = useState('');
  const [pendentes, setPendentes] = useState<PendenteDaAbertura[]>([]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  // O PIN fica guardado só durante o fluxo: marcar os presentes exige ele de
  // novo, e pedir duas vezes com a equipe esperando na porta é o tipo de
  // atrito que faz todo mundo voltar pro caderno.
  const confirmarPin = async () => {
    if (pin.length !== 4) return;
    setEnviando(true);
    const r = await abrirLoja(pin);
    setEnviando(false);

    if (!r.ok) {
      setPin('');
      onFim({ ok: false, mensagem: r.mensagem ?? 'Não foi possível abrir a loja.' });
      return;
    }

    setResponsavel(r.nome ?? 'Responsável');
    setHora((r.hora_abertura ?? '').slice(0, 5));
    setPendentes(r.pendentes ?? []);
    setMarcados(new Set());
  };

  const alternar = (id: string) =>
    setMarcados((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  const confirmarPresentes = async () => {
    setEnviando(true);
    const r = await marcarPresentes(pin, [...marcados]);
    setEnviando(false);
    setPin('');

    if (!r.ok) {
      onFim({ ok: false, mensagem: r.mensagem ?? 'Não foi possível marcar.' });
      return;
    }

    const qtd = r.entradas_registradas ?? 0;
    onFim({
      ok: true,
      destaque: String(qtd),
      detalhe: qtd === 1 ? 'entrada registrada' : 'entradas registradas',
      mensagem:
        qtd === 0
          ? 'Ninguém novo foi marcado. Quem já tinha batido continua como estava.'
          : `Às ${(r.hora ?? hora).slice(0, 5)}. Cada um confirma depois, em Meu ponto.`,
    });
  };

  if (!responsavel) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-7">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full bg-[#B8860B]/10 flex items-center justify-center mx-auto mb-4">
            <DoorOpen className="h-6 w-6 text-[#B8860B]" />
          </div>
          <p className="text-xl font-heading">Abrir a loja</p>
          <p className="text-sm text-[#55605F] mt-1.5 max-w-xs">
            Digite o PIN de quem está abrindo. A entrada de quem estava na porta sai no nome dessa
            pessoa.
          </p>
        </div>

        <Teclado
          valor={pin}
          onChange={setPin}
          onConfirmar={confirmarPin}
          confirmando={enviando}
          tom="loja"
        />
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col px-5 pb-4 gap-4 min-h-0">
      <div className="text-center">
        <p className="text-sm text-[#55605F]">
          Loja aberta às <span className="font-mono text-[#141B1E] font-semibold">{hora}</span> por{' '}
          {responsavel}
        </p>
        <p className="text-base text-[#141B1E] mt-1">Quem já estava na porta?</p>
        <p className="text-xs text-[#8A9290] mt-0.5">A lista fecha em 10 minutos.</p>
      </div>

      <div className="flex-1 overflow-y-auto grid gap-2.5 sm:grid-cols-2 content-start">
        {pendentes.length === 0 && (
          <p className="text-[#55605F] p-4 text-center sm:col-span-2">
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
                'h-[4.25rem] rounded-2xl border px-5 flex items-center gap-4 text-left text-lg transition active:scale-[0.99]',
                marcado
                  ? 'border-primary bg-primary/5 text-[#141B1E]'
                  : 'border-[#DCDFD8] bg-white text-[#55605F] hover:border-primary/40'
              )}
            >
              <span
                className={cn(
                  'h-7 w-7 rounded-lg border-2 shrink-0 flex items-center justify-center text-sm font-bold',
                  marcado ? 'border-primary bg-primary text-white' : 'border-[#DCDFD8]'
                )}
              >
                {marcado ? '✓' : ''}
              </span>
              {p.nome}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={marcados.size === 0 || enviando}
        onClick={confirmarPresentes}
        className="h-16 rounded-2xl bg-primary text-primary-foreground text-lg font-medium flex items-center justify-center gap-3 disabled:bg-[#141B1E]/10 disabled:text-[#141B1E]/30 active:scale-[0.99] transition"
      >
        {enviando && <Loader2 className="h-5 w-5 animate-spin" />}
        Registrar entrada de {marcados.size}
      </button>
    </main>
  );
};

export default AbrirLoja;

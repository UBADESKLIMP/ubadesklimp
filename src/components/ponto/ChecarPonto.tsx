import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Loader2 } from 'lucide-react';
import Teclado from './Teclado';
import { TIPO_LABEL, type ResultadoMinhasMarcacoes } from '@/hooks/usePontoQuiosque';

interface Props {
  minhasMarcacoes: (pin: string) => Promise<ResultadoMinhasMarcacoes>;
  onVoltar: () => void;
}

/** A lista some sozinha: o PIN e as batidas não ficam à vista de quem chega depois. */
const SEGUNDOS_NA_TELA = 20;

/**
 * "Checar ponto": para quem bateu e ficou na dúvida se registrou. Mostra só as
 * batidas de hoje da pessoa que digitou o PIN, sem permitir mexer em nada.
 */
const ChecarPonto = ({ minhasMarcacoes, onVoltar }: Props) => {
  const [pin, setPin] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoMinhasMarcacoes | null>(null);
  const [restante, setRestante] = useState(SEGUNDOS_NA_TELA);

  const consultar = async () => {
    if (pin.length !== 4) return;
    setConsultando(true);
    setErro(null);
    const r = await minhasMarcacoes(pin);
    setConsultando(false);
    setPin('');
    if (!r.ok) {
      setErro(r.mensagem ?? 'Não conseguimos consultar agora.');
      return;
    }
    setRestante(SEGUNDOS_NA_TELA);
    setResultado(r);
  };

  useEffect(() => {
    if (!resultado) return;
    if (restante <= 0) {
      onVoltar();
      return;
    }
    const t = setTimeout(() => setRestante((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resultado, restante, onVoltar]);

  if (!resultado) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-6 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <ClipboardCheck className="h-6 w-6 text-white" />
          </div>
          <p className="text-xl font-heading">Checar meu ponto</p>
          <p className="mt-1.5 max-w-xs text-sm text-white/75">
            Digite seu PIN para ver o que você já bateu hoje. Não precisa bater de novo.
          </p>
        </div>

        <Teclado valor={pin} onChange={setPin} onConfirmar={consultar} confirmando={consultando} erro={erro} plano />

        <p className="min-h-5 text-center text-sm font-medium text-[#FFB4AA]">{erro}</p>
      </main>
    );
  }

  const marcacoes = resultado.marcacoes ?? [];
  const dia = resultado.dia ? `${resultado.dia.slice(8, 10)}/${resultado.dia.slice(5, 7)}` : 'hoje';

  return (
    <main className="flex flex-1 flex-col items-center gap-5 px-6 pb-6 pt-2 text-white">
      <div className="text-center">
        <p className="text-sm text-white/70">Ponto de hoje, {dia}</p>
        <p className="text-2xl font-semibold">{resultado.nome}</p>
      </div>

      <div className="w-full max-w-sm space-y-2.5">
        {marcacoes.length === 0 ? (
          <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-6 text-center">
            <p className="text-lg font-semibold">Nenhuma batida hoje</p>
            <p className="mt-1 text-sm text-white/75">Se você já bateu, avise o gestor antes de bater de novo.</p>
          </div>
        ) : (
          marcacoes.map((m, i) => (
            <div
              key={`${m.tipo}-${m.hora}-${i}`}
              className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-4"
            >
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-300" />
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium">{TIPO_LABEL[m.tipo] ?? m.tipo}</p>
                {m.origem === 'abertura_coletiva' && (
                  <p className="text-xs text-white/65">marcada na abertura da loja</p>
                )}
              </div>
              <span className="font-mono text-2xl font-semibold tabular-nums">{m.hora}</span>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={onVoltar}
        className="mt-1 flex h-14 w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-white text-base font-semibold text-[#0b1020]"
      >
        {consultando && <Loader2 className="h-4 w-4 animate-spin" />}
        Pronto
      </button>
      <p className="text-xs text-white/55">Esta tela fecha sozinha em {restante}s</p>
    </main>
  );
};

export default ChecarPonto;

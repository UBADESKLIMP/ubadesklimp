import { useEffect, useState } from 'react';
import { Check, Footprints, Loader2, X } from 'lucide-react';
import Teclado from './Teclado';
import type { PedidoDeClienteAConfirmar, ResultadoChinelosAConfirmar } from '@/hooks/usePontoQuiosque';

interface Props {
  listar: (pin: string) => Promise<ResultadoChinelosAConfirmar>;
  decidir: (pin: string, id: string, aceitar: boolean) => Promise<{ ok: boolean; mensagem?: string }>;
  onFim: (a: { ok: boolean; destaque?: string; mensagem?: string }) => void;
}

/**
 * Pedidos de chinelo que o próprio cliente fez pelo QR. Um funcionário digita o
 * PIN e aceita (vai para "Para encomendar") ou recusa, sem abrir o painel.
 */
const ConfirmarChinelos = ({ listar, decidir, onFim }: Props) => {
  const [pin, setPin] = useState('');
  const [pinOk, setPinOk] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [erroPin, setErroPin] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<PedidoDeClienteAConfirmar[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const entrar = async () => {
    if (consultando || pin.length < 4) return;
    setConsultando(true);
    const r = await listar(pin);
    setConsultando(false);
    if (!r.ok) {
      setPin('');
      setErroPin(r.mensagem ?? 'Não deu para consultar.');
      return;
    }
    setPinOk(pin);
    setPin('');
    setPedidos(r.pedidos ?? []);
  };

  const decidirPedido = async (p: PedidoDeClienteAConfirmar, aceitar: boolean) => {
    setOcupado(p.id);
    setErro(null);
    const r = await decidir(pinOk, p.id, aceitar);
    setOcupado(null);
    if (!r.ok) {
      setErro(r.mensagem ?? 'Não deu para salvar.');
    }
    // Some da lista de qualquer jeito: se "já foi tratado", também não está mais pendente.
    setPedidos((atual) => (atual ?? []).filter((x) => x.id !== p.id));
  };

  // Acabou a fila: volta sozinho com um aviso.
  useEffect(() => {
    if (pedidos && pedidos.length === 0) {
      setPinOk('');
      onFim({ ok: true, destaque: 'Tudo certo', mensagem: 'Não há mais pedidos de chinelo para confirmar.' });
    }
  }, [pedidos, onFim]);

  if (!pedidos) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-7 p-6 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <Footprints className="h-6 w-6 text-white" />
          </div>
          <p className="text-xl font-heading">Pedidos de chinelo dos clientes</p>
          <p className="mt-1.5 max-w-xs text-sm text-white/75">
            Digite seu PIN para ver os pedidos feitos pelo QR e aceitar ou recusar.
          </p>
        </div>
        <Teclado
          valor={pin}
          onChange={(v) => {
            setPin(v);
            setErroPin(null);
          }}
          onConfirmar={entrar}
          confirmando={consultando}
          erro={erroPin}
          plano
        />
        <p className="min-h-5 text-center text-sm font-medium text-[#FFB4AA]">{erroPin}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4 text-white">
      <div className="mx-auto w-full max-w-xl space-y-3">
        <p className="text-center text-xl font-heading">
          {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'} para confirmar
        </p>
        {erro && <p className="text-center text-sm font-medium text-[#FFB4AA]">{erro}</p>}
        {pedidos.map((p) => (
          <div key={p.id} className="rounded-2xl border border-white/20 bg-white/10 p-4">
            <p className="text-lg font-semibold">{p.nome}</p>
            <p className="text-sm text-white/75">{p.telefone}</p>
            <p className="mt-2 text-base">
              nº <b>{p.numero}</b> · {p.cor}
            </p>
            {p.observacao && <p className="mt-1 text-sm text-white/70">{p.observacao}</p>}
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                disabled={ocupado !== null}
                onClick={() => decidirPedido(p, true)}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-base font-semibold text-[#0b1020] transition active:scale-[0.98] disabled:opacity-50"
              >
                {ocupado === p.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                Aceitar
              </button>
              <button
                type="button"
                disabled={ocupado !== null}
                onClick={() => decidirPedido(p, false)}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/30 px-5 text-base font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
              >
                <X className="h-5 w-5" />
                Recusar
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
};

export default ConfirmarChinelos;

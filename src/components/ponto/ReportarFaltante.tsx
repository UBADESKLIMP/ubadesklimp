import { useEffect, useState } from 'react';
import { Loader2, Search, PackagePlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Teclado from './Teclado';
import type { ProdutoDoQuiosque, ResultadoFaltante } from '@/hooks/usePontoQuiosque';

interface AvisoAtual {
  ok: boolean;
  nome?: string;
  destaque?: string;
  detalhe?: string;
  mensagem?: string;
}

interface Props {
  buscarProduto: (termo: string) => Promise<ProdutoDoQuiosque[]>;
  reportarFaltante: (pin: string, produtoId: string) => Promise<ResultadoFaltante>;
  onFim: (a: AvisoAtual) => void;
  onVoltar: () => void;
}

const ReportarFaltante = ({ buscarProduto, reportarFaltante, onFim, onVoltar }: Props) => {
  const [termo, setTermo] = useState('');
  const [produtos, setProdutos] = useState<ProdutoDoQuiosque[]>([]);
  const [procurando, setProcurando] = useState(false);
  const [produto, setProduto] = useState<ProdutoDoQuiosque | null>(null);
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Folga de 300 ms: no balcão a pessoa digita devagar e cada letra viraria
  // uma ida ao banco.
  useEffect(() => {
    if (termo.trim().length < 2) {
      setProdutos([]);
      return;
    }
    let cancelado = false;
    setProcurando(true);
    const t = setTimeout(async () => {
      const r = await buscarProduto(termo);
      if (!cancelado) {
        setProdutos(r);
        setProcurando(false);
      }
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [termo, buscarProduto]);

  const confirmar = async () => {
    if (!produto || pin.length !== 4) return;
    setEnviando(true);
    const r = await reportarFaltante(pin, produto.id);
    setEnviando(false);
    setPin('');

    if (!r.ok) {
      onFim({ ok: false, mensagem: r.mensagem ?? 'Não foi possível registrar.' });
      return;
    }

    onFim({
      ok: true,
      destaque: 'Anotado',
      detalhe: produto.nome,
      mensagem: r.ja_existia
        ? `Já estava na lista — agora com ${r.reportes} avisos.`
        : 'Entrou na lista de faltantes para comprar.',
    });
  };

  if (produto) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-7">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full bg-[#0F6B5C]/10 flex items-center justify-center mx-auto mb-4">
            <PackagePlus className="h-6 w-6 text-[#0F6B5C]" />
          </div>
          <p className="text-xl font-heading max-w-xs">{produto.nome}</p>
          <p className="text-sm text-[#55605F] mt-1.5">Digite seu PIN para confirmar que está acabando</p>
        </div>

        <Teclado valor={pin} onChange={setPin} onConfirmar={confirmar} confirmando={enviando} />

        <button
          type="button"
          onClick={() => {
            setProduto(null);
            setPin('');
          }}
          className="text-sm text-[#55605F] hover:text-[#141B1E] py-2 px-4"
        >
          Trocar produto
        </button>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col px-5 pb-4 gap-3 min-h-0">
      <Input
        autoFocus
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="O que está acabando?"
        className="h-14 text-base bg-white border-[#DCDFD8] rounded-2xl px-5"
      />

      <div className="flex-1 overflow-y-auto grid gap-2.5 sm:grid-cols-2 content-start">
        {procurando && (
          <p className="text-[#55605F] p-4 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Procurando…
          </p>
        )}
        {!procurando && termo.trim().length < 2 && (
          <p className="text-[#8A9290] p-4 flex items-center gap-2">
            <Search className="h-4 w-4" />
            Digite o nome ou a marca do produto.
          </p>
        )}
        {!procurando && termo.trim().length >= 2 && produtos.length === 0 && (
          <p className="text-[#55605F] p-4">
            Nenhum produto com esse nome. Avise o comprador direto.
          </p>
        )}
        {produtos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setProduto(p);
              setPin('');
            }}
            className="min-h-[4.25rem] rounded-2xl border border-[#DCDFD8] bg-white px-5 py-3.5 text-left hover:border-[#0F6B5C]/40 active:scale-[0.99] transition"
          >
            <span className="block text-base leading-tight text-[#141B1E]">{p.nome}</span>
            {p.marca && <span className="block text-sm text-[#8A9290] mt-0.5">{p.marca}</span>}
          </button>
        ))}
      </div>
    </main>
  );
};

export default ReportarFaltante;

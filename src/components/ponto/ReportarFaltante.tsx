import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TecladoPin from './TecladoPin';
import EscolherPessoa from './EscolherPessoa';
import type {
  FuncionarioDoQuiosque,
  ProdutoDoQuiosque,
  ResultadoFaltante,
} from '@/hooks/usePontoQuiosque';

interface Props {
  funcionarios: FuncionarioDoQuiosque[];
  buscarProduto: (termo: string) => Promise<ProdutoDoQuiosque[]>;
  reportarFaltante: (
    funcionarioId: string,
    pin: string,
    produtoId: string
  ) => Promise<ResultadoFaltante>;
  onFim: (ok: boolean, destaque?: string, detalhe?: string, mensagem?: string) => void;
  onVoltar: () => void;
}

type Passo = 'produto' | 'quem' | 'pin';

const ReportarFaltante = ({
  funcionarios,
  buscarProduto,
  reportarFaltante,
  onFim,
  onVoltar,
}: Props) => {
  const [passo, setPasso] = useState<Passo>('produto');
  const [termo, setTermo] = useState('');
  const [produtos, setProdutos] = useState<ProdutoDoQuiosque[]>([]);
  const [procurando, setProcurando] = useState(false);
  const [produto, setProduto] = useState<ProdutoDoQuiosque | null>(null);
  const [pessoa, setPessoa] = useState<FuncionarioDoQuiosque | null>(null);
  const [busca, setBusca] = useState('');
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Busca com folga de 300 ms: no balcão a pessoa digita devagar e cada letra
  // viraria uma ida ao banco.
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
    if (!pessoa || !produto || pin.length !== 4) return;
    setEnviando(true);
    const r = await reportarFaltante(pessoa.id, pin, produto.id);
    setEnviando(false);
    setPin('');

    if (!r.ok) {
      onFim(false, undefined, undefined, r.mensagem ?? 'Não foi possível registrar.');
      return;
    }

    onFim(
      true,
      'Anotado',
      produto.nome,
      r.ja_existia
        ? `Já estava na lista — agora com ${r.reportes} avisos.`
        : 'Entrou na lista de faltantes para comprar.'
    );
  };

  if (passo === 'produto') {
    return (
      <main className="flex-1 flex flex-col p-4 gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-12 w-12" onClick={onVoltar}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Input
            autoFocus
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="O que está acabando?"
            className="h-12 text-base"
          />
        </div>

        <div className="flex-1 overflow-y-auto grid gap-2 sm:grid-cols-2 content-start">
          {procurando && (
            <p className="text-muted-foreground p-4 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Procurando…
            </p>
          )}
          {!procurando && termo.trim().length < 2 && (
            <p className="text-muted-foreground p-4 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Digite o nome ou a marca do produto.
            </p>
          )}
          {!procurando && termo.trim().length >= 2 && produtos.length === 0 && (
            <p className="text-muted-foreground p-4">
              Nenhum produto com esse nome. Avise o comprador direto.
            </p>
          )}
          {produtos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setProduto(p);
                setPasso('quem');
              }}
              className="min-h-16 rounded-xl border bg-card px-4 py-3 text-left hover:bg-accent active:scale-[0.99] transition"
            >
              <span className="block text-base leading-tight">{p.nome}</span>
              {p.marca && (
                <span className="block text-sm text-muted-foreground mt-0.5">{p.marca}</span>
              )}
            </button>
          ))}
        </div>
      </main>
    );
  }

  if (passo === 'quem') {
    return (
      <EscolherPessoa
        funcionarios={funcionarios}
        busca={busca}
        onBusca={setBusca}
        onEscolher={(f) => {
          setPessoa(f);
          setPin('');
          setPasso('pin');
        }}
        onVoltar={() => setPasso('produto')}
      />
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <p className="text-2xl font-heading">{pessoa?.nome}</p>
        <p className="text-muted-foreground mt-1">
          Confirme com seu PIN que <span className="text-foreground">{produto?.nome}</span> está
          acabando
        </p>
      </div>

      <TecladoPin valor={pin} onChange={setPin} onConfirmar={confirmar} confirmando={enviando} />

      <Button variant="ghost" className="h-12" onClick={onVoltar}>
        Cancelar
      </Button>
    </main>
  );
};

export default ReportarFaltante;

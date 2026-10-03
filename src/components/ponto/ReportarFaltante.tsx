import { useEffect, useState } from 'react';
import { Loader2, Search, PackagePlus, X, Plus, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Teclado from './Teclado';
import type { ProdutoDoQuiosque, ResultadoFaltantes } from '@/hooks/usePontoQuiosque';

interface AvisoAtual {
  ok: boolean;
  nome?: string;
  destaque?: string;
  detalhe?: string;
  mensagem?: string;
}

interface Props {
  buscarProduto: (termo: string) => Promise<ProdutoDoQuiosque[]>;
  reportarFaltantes: (pin: string, produtoIds: string[]) => Promise<ResultadoFaltantes>;
  onFim: (a: AvisoAtual) => void;
  onVoltar: () => void;
}

/**
 * Quem vai ao estoque volta com três ou quatro itens, não um. Então o PIN vem
 * uma vez no começo e depois a pessoa vai juntando produtos numa lista, como
 * um carrinho, até mandar tudo de uma vez.
 */
const ReportarFaltante = ({ buscarProduto, reportarFaltantes, onFim }: Props) => {
  const [pin, setPin] = useState('');
  const [autorizado, setAutorizado] = useState(false);
  const [termo, setTermo] = useState('');
  const [produtos, setProdutos] = useState<ProdutoDoQuiosque[]>([]);
  const [procurando, setProcurando] = useState(false);
  const [lista, setLista] = useState<ProdutoDoQuiosque[]>([]);
  const [enviando, setEnviando] = useState(false);

  // Folga de 300 ms: no balcão a pessoa digita devagar e cada letra viraria
  // uma ida ao banco.
  useEffect(() => {
    if (!autorizado || termo.trim().length < 2) {
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
  }, [termo, autorizado, buscarProduto]);

  const adicionar = (p: ProdutoDoQuiosque) => {
    setLista((atual) => (atual.some((x) => x.id === p.id) ? atual : [...atual, p]));
    setTermo('');
    setProdutos([]);
  };

  const tirar = (id: string) => setLista((atual) => atual.filter((p) => p.id !== id));

  const enviar = async () => {
    if (lista.length === 0) return;
    setEnviando(true);
    const r = await reportarFaltantes(
      pin,
      lista.map((p) => p.id)
    );
    setEnviando(false);
    setPin('');

    if (!r.ok) {
      onFim({ ok: false, mensagem: r.mensagem ?? 'Não foi possível registrar.' });
      return;
    }

    onFim({
      ok: true,
      destaque: String(r.total ?? lista.length),
      detalhe: (r.total ?? lista.length) === 1 ? 'produto anotado' : 'produtos anotados',
      mensagem: r.mensagem,
    });
  };

  // O PIN abre a sessão de uma vez só: depois é só ir juntando produtos.
  if (!autorizado) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-7">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <PackagePlus className="h-6 w-6 text-primary" />
          </div>
          <p className="text-xl font-heading">O que está faltando?</p>
          <p className="text-sm text-[#55605F] mt-1.5 max-w-xs">
            Digite seu PIN e depois vá anotando os produtos. Manda tudo de uma vez no fim.
          </p>
        </div>

        <Teclado
          valor={pin}
          onChange={setPin}
          onConfirmar={() => setAutorizado(true)}
          confirmando={false}
        />
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col px-5 pb-4 gap-3 min-h-0">
      <Input
        autoFocus
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar produto para anotar"
        className="h-14 text-base bg-white border-[#DCDFD8] rounded-2xl px-5"
      />

      {/* A lista do que já foi anotado fica sempre à vista: é o que vai ser
          enviado, e some do caminho quando está vazia. */}
      {lista.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lista.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/30 pl-4 pr-2 py-2 text-sm text-[#141B1E]"
            >
              {p.nome}
              <button
                type="button"
                onClick={() => tirar(p.id)}
                className="h-6 w-6 rounded-full hover:bg-primary/20 flex items-center justify-center"
                aria-label={`Tirar ${p.nome} da lista`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

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
            {lista.length === 0
              ? 'Digite o nome ou a marca do produto.'
              : 'Busque outro produto, ou envie a lista abaixo.'}
          </p>
        )}
        {!procurando && termo.trim().length >= 2 && produtos.length === 0 && (
          <p className="text-[#55605F] p-4">
            Nenhum produto com esse nome. Avise o comprador direto.
          </p>
        )}
        {produtos.map((p) => {
          const jaEsta = lista.some((x) => x.id === p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => adicionar(p)}
              disabled={jaEsta}
              className={cn(
                'min-h-[4.25rem] rounded-2xl border px-5 py-3.5 text-left transition flex items-center gap-3',
                jaEsta
                  ? 'border-primary/30 bg-primary/5 text-[#8A9290]'
                  : 'border-[#DCDFD8] bg-white hover:border-primary/40 active:scale-[0.99]'
              )}
            >
              {jaEsta ? (
                <Check className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Plus className="h-4 w-4 text-[#8A9290] shrink-0" />
              )}
              <span className="min-w-0">
                <span className="block text-base leading-tight text-[#141B1E]">{p.nome}</span>
                {p.marca && <span className="block text-sm text-[#8A9290] mt-0.5">{p.marca}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={lista.length === 0 || enviando}
        onClick={enviar}
        className="h-16 rounded-2xl bg-primary text-primary-foreground text-lg font-medium flex items-center justify-center gap-3 disabled:bg-[#141B1E]/10 disabled:text-[#141B1E]/30 active:scale-[0.99] transition"
      >
        {enviando && <Loader2 className="h-5 w-5 animate-spin" />}
        {lista.length === 0
          ? 'Anote ao menos um produto'
          : `Enviar ${lista.length} ${lista.length === 1 ? 'produto' : 'produtos'}`}
      </button>
    </main>
  );
};

export default ReportarFaltante;

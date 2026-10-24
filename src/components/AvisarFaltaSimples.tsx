import { useMemo, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, ClipboardCheck, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useMissingProducts } from '@/hooks/useMissingProducts';
import { buildMissingItemDisplayName } from '@/lib/missingProductDisplay';
import { cn, normalizeText } from '@/lib/utils';
import { ProductWithVariations } from '@/types/product';
import AdminPageHeader from './admin/AdminPageHeader';

interface AvisarFaltaSimplesProps {
  products: ProductWithVariations[];
}

interface Escolha {
  productId: string;
  fragranceId: string | null;
  variationId: string | null;
  stock: string;
}

type Tela = 'busca' | 'detalhes' | 'feito';

const MAX_RESULTADOS = 8;
const MAX_RECENTES = 6;

const Chip = ({ ativo, children, onClick }: { ativo: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'min-h-12 rounded-xl border px-4 text-base font-medium transition-colors',
      ativo
        ? 'border-adm-accent bg-adm-accent text-adm-on-accent'
        : 'border-adm-line bg-adm-surface text-adm-ink hover:border-adm-accent-line'
    )}
  >
    {children}
  </button>
);

// Tela do funcionário que só avisa o que acabou: busca grande, toque no
// produto, quantos sobraram, avisar. Sem preço, sem dinheiro, sem lista de
// compra.
const AvisarFaltaSimples = ({ products }: AvisarFaltaSimplesProps) => {
  const { user } = useAuth();
  const { missingProducts, reportMissingProducts, displayNameStatus } = useMissingProducts();
  const [tela, setTela] = useState<Tela>('busca');
  const [busca, setBusca] = useState('');
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [avisado, setAvisado] = useState<string>('');

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const termo = normalizeText(busca.trim());
  const resultados = useMemo(() => {
    if (termo.length < 2) return [];
    return products
      .filter((p) => normalizeText(`${p.name} ${p.brand ?? ''}`).includes(termo))
      .slice(0, MAX_RESULTADOS);
  }, [products, termo]);

  // Os últimos itens que esta pessoa avisou, sem repetir o mesmo produto.
  const recentes = useMemo(() => {
    if (!user) return [];
    const vistos = new Set<string>();
    return [...missingProducts]
      .filter((item) => item.reported_by === user.id)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .filter((item) => {
        const chave = `${item.product_id}|${item.fragrance_id}|${item.variation_id}`;
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      })
      .slice(0, MAX_RECENTES);
  }, [missingProducts, user]);

  const produto = escolha ? productById.get(escolha.productId) : undefined;
  const fragrancias = produto?.fragrances ?? [];
  const todasVariacoes = produto?.variations ?? [];
  const fragranciaEscolhida = fragrancias.find((f) => f.id === escolha?.fragranceId);
  const variacoesFiltradas = fragranciaEscolhida?.available_literages?.length
    ? todasVariacoes.filter((v) => fragranciaEscolhida.available_literages!.includes(v.literage))
    : todasVariacoes;
  const variacoes = variacoesFiltradas.length > 0 ? variacoesFiltradas : todasVariacoes;

  const completo =
    !!escolha &&
    (fragrancias.length === 0 || !!escolha.fragranceId) &&
    (todasVariacoes.length === 0 || !!escolha.variationId);

  const escolher = (productId: string, fragranceId: string | null = null, variationId: string | null = null) => {
    setEscolha({ productId, fragranceId, variationId, stock: '' });
    setTela('detalhes');
  };

  const voltar = () => {
    setTela('busca');
    setEscolha(null);
  };

  const novoAviso = () => {
    setBusca('');
    setEscolha(null);
    setAvisado('');
    setTela('busca');
  };

  const avisar = async () => {
    if (!escolha || !completo) return;
    setEnviando(true);
    try {
      const stock = escolha.stock.trim() === '' ? null : Math.max(0, parseInt(escolha.stock, 10) || 0);
      const { succeeded } = await reportMissingProducts([
        {
          key: 'unico',
          productId: escolha.productId,
          fragranceId: escolha.fragranceId,
          variationId: escolha.variationId,
          stockRemaining: stock,
        },
      ]);
      if (succeeded.length > 0) {
        setAvisado(buildMissingItemDisplayName(produto, escolha.fragranceId, escolha.variationId));
        setTela('feito');
      }
    } catch {
      // o erro já aparece como aviso na tela (toast do hook)
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <AdminPageHeader
        icon={ClipboardCheck}
        title="Avisar que acabou um produto"
        description="Procure o produto, diga quantos sobraram e avise."
      />

      {tela === 'busca' && (
        <div className="space-y-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-adm-faint" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Qual produto acabou?"
              aria-label="Qual produto acabou?"
              className="h-16 rounded-xl border-adm-line bg-adm-surface pl-14 text-lg"
            />
          </div>

          {termo.length >= 2 && resultados.length === 0 && (
            <p className="text-base text-adm-muted">
              Nenhum produto com esse nome. Confira como está escrito ou tente só uma parte do nome.
            </p>
          )}

          {resultados.length > 0 && (
            <div className="space-y-2">
              {resultados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => escolher(p.id)}
                  className="flex min-h-16 w-full items-center rounded-xl border border-adm-line bg-adm-surface px-5 text-left text-lg font-medium text-adm-ink transition hover:border-adm-accent-line"
                >
                  {p.name}
                  {p.brand ? <span className="ml-2 text-sm font-normal text-adm-muted">{p.brand}</span> : null}
                </button>
              ))}
            </div>
          )}

          {termo.length < 2 && recentes.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-adm-muted">Os últimos que você avisou</p>
              {recentes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => escolher(item.product_id, item.fragrance_id, item.variation_id)}
                  className="flex min-h-16 w-full items-center rounded-xl border border-adm-line bg-adm-surface px-5 text-left text-base font-medium text-adm-ink transition hover:border-adm-accent-line"
                >
                  {buildMissingItemDisplayName(productById.get(item.product_id), item.fragrance_id, item.variation_id)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tela === 'detalhes' && escolha && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={voltar}
            className="flex min-h-11 items-center gap-2 text-base font-medium text-adm-accent"
          >
            <ArrowLeft className="h-5 w-5" />
            Escolher outro produto
          </button>

          <h3 className="text-2xl font-semibold text-adm-ink">{produto?.name ?? 'Produto'}</h3>

          {fragrancias.length > 0 && (
            <div className="space-y-2">
              <p className="text-base font-medium text-adm-ink">Qual fragrância?</p>
              <div className="flex flex-wrap gap-2">
                {fragrancias.map((f) => (
                  <Chip
                    key={f.id}
                    ativo={escolha.fragranceId === f.id}
                    onClick={() => setEscolha({ ...escolha, fragranceId: f.id, variationId: null })}
                  >
                    {f.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {todasVariacoes.length > 0 && (
            <div className="space-y-2">
              <p className="text-base font-medium text-adm-ink">Qual tamanho?</p>
              <div className="flex flex-wrap gap-2">
                {variacoes.map((v) => (
                  <Chip
                    key={v.id}
                    ativo={escolha.variationId === v.id}
                    onClick={() => setEscolha({ ...escolha, variationId: v.id })}
                  >
                    {v.literage}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="sobraram" className="text-base font-medium text-adm-ink">
              Quantos sobraram? <span className="font-normal text-adm-muted">(se não souber, deixe em branco)</span>
            </label>
            <div className="flex items-center gap-3">
              <Input
                id="sobraram"
                type="number"
                inputMode="numeric"
                min="0"
                value={escolha.stock}
                onChange={(e) => setEscolha({ ...escolha, stock: e.target.value })}
                placeholder="0"
                className="h-16 w-32 rounded-xl border-adm-line bg-adm-surface text-center text-2xl"
              />
              <Chip ativo={escolha.stock === '0'} onClick={() => setEscolha({ ...escolha, stock: '0' })}>
                Acabou tudo
              </Chip>
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            className="h-16 w-full rounded-xl text-lg"
            disabled={enviando || !completo || displayNameStatus !== 'ready'}
            onClick={avisar}
          >
            {enviando ? 'Enviando...' : 'Avisar'}
          </Button>
          {!completo && (
            <p className="text-sm text-adm-muted">Escolha {fragrancias.length > 0 && !escolha.fragranceId ? 'a fragrância' : 'o tamanho'} para continuar.</p>
          )}
        </div>
      )}

      {tela === 'feito' && (
        <div className="space-y-6 py-8 text-center">
          <CheckCircle2 className="mx-auto h-20 w-20" style={{ color: 'var(--adm-ok-text)' }} />
          <div className="space-y-1">
            <h3 className="text-2xl font-semibold text-adm-ink">Pronto, avisado!</h3>
            <p className="text-base text-adm-muted">{avisado}</p>
          </div>
          <Button type="button" size="lg" className="h-16 w-full rounded-xl text-lg" onClick={novoAviso}>
            <Check className="mr-2 h-5 w-5" />
            Avisar outro produto
          </Button>
        </div>
      )}
    </div>
  );
};

export default AvisarFaltaSimples;

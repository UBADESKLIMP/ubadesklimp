import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileText, Plus, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { lerArquivoErp } from '@/lib/listaErp';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import { useEquipeAccess } from '@/hooks/useEquipeAccess';
import OrcamentoEditor, { dinheiro, type ItemOrcamento, type OrcamentoRegistro } from './OrcamentoEditor';

type Aba = 'rascunho' | 'confirmado' | 'cancelado';

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'rascunho', rotulo: 'Rascunhos' },
  { valor: 'confirmado', rotulo: 'Confirmados' },
  { valor: 'cancelado', rotulo: 'Cancelados' },
];

const dataHora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));

/**
 * Orçamento de cliente (lista que chega pelo WhatsApp): monta a OR com itens que
 * a loja realmente vendeu, marca o que ficou em dúvida e a pessoa responsável
 * ajusta e confirma. Fica só como orçamento: não entra na fila de entregas.
 */
const OrcamentosManager = () => {
  const equipeAccess = useEquipeAccess();
  const empresaId = equipeAccess.empresaIds[0] ?? null;

  const [lista, setLista] = useState<OrcamentoRegistro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>('rascunho');
  const [editando, setEditando] = useState<OrcamentoRegistro | 'novo' | null>(null);

  const carregar = useCallback(async () => {
    if (!empresaId) return;
    const { data, error } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      setErro(error.message);
    } else {
      setErro(null);
      setLista(
        (data ?? []).map((o) => ({
          ...o,
          situacao: o.situacao as OrcamentoRegistro['situacao'],
          itens: (Array.isArray(o.itens) ? o.itens : []) as unknown as ItemOrcamento[],
        }))
      );
    }
    setCarregando(false);
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Lista de produtos do ERP (código + preço + saldo), importada do CSV do relatório de Produtos.
  const { toast } = useToast();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [infoErp, setInfoErp] = useState<{ total: number; atualizado: string | null } | null>(null);
  const [importando, setImportando] = useState<string | null>(null);

  const carregarInfoErp = useCallback(async () => {
    if (!empresaId) return;
    const { data, count } = await supabase
      .from('erp_produtos')
      .select('atualizado_em', { count: 'exact' })
      .eq('empresa_id', empresaId)
      .order('atualizado_em', { ascending: false })
      .limit(1);
    setInfoErp({ total: count ?? 0, atualizado: data?.[0]?.atualizado_em ?? null });
  }, [empresaId]);

  useEffect(() => {
    carregarInfoErp();
  }, [carregarInfoErp]);

  const importarLista = async (arquivo: File) => {
    if (!empresaId) return;
    try {
      setImportando('Lendo o arquivo...');
      const linhas = await lerArquivoErp(arquivo);
      if (linhas.length < 100) {
        toast({
          title: 'Esse arquivo não parece a lista de produtos do ERP',
          description: 'Use o CSV de Estoque → Relatórios → Produtos (Exporta para Excel).',
          variant: 'destructive',
        });
        return;
      }
      const TAMANHO = 400;
      for (let i = 0; i < linhas.length; i += TAMANHO) {
        setImportando(`Enviando ${Math.min(i + TAMANHO, linhas.length)} de ${linhas.length}...`);
        const { error } = await supabase.rpc('erp_produtos_importar', {
          p_empresa_id: empresaId,
          p_linhas: linhas.slice(i, i + TAMANHO) as unknown as Json,
          p_primeiro: i === 0,
        });
        if (error) throw new Error(error.message);
      }
      toast({ title: 'Lista do ERP importada', description: `${linhas.length} produtos com código, preço e saldo.` });
      await carregarInfoErp();
    } catch (e) {
      toast({ title: 'A importação parou', description: e instanceof Error ? e.message : 'Tente de novo.', variant: 'destructive' });
    } finally {
      setImportando(null);
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  };

  if (equipeAccess.loading) return <AdminLoadingState />;

  if (!empresaId) {
    return (
      <AdminEmptyState
        icon={FileText}
        title="Nenhuma empresa vinculada a você"
        description="Cadastre a empresa em Equipe → Configurações antes de montar orçamentos."
      />
    );
  }

  if (editando) {
    return (
      <div>
        <AdminPageHeader icon={FileText} title={editando === 'novo' ? 'Novo orçamento' : 'Orçamento'} />
        <OrcamentoEditor
          empresaId={empresaId}
          orcamento={editando === 'novo' ? null : editando}
          onVoltar={() => setEditando(null)}
          onSalvou={() => {
            setEditando(null);
            carregar();
          }}
        />
      </div>
    );
  }

  const daAba = lista.filter((o) => o.situacao === aba);

  return (
    <div>
      <AdminPageHeader
        icon={FileText}
        title="Orçamentos"
        description="Monte a OR do cliente com itens que a loja vende. O que ficar em dúvida é marcado para conferir."
        action={
          <Button onClick={() => setEditando('novo')} className="h-11 bg-adm-accent text-white hover:bg-adm-accent/90">
            <Plus className="mr-2 h-4 w-4" /> Novo orçamento
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-adm-line bg-adm-surface px-4 py-3">
        <Upload className="h-4 w-4 shrink-0 text-adm-accent" />
        <p className="min-w-0 flex-1 text-xs text-adm-muted">
          {infoErp && infoErp.total > 0
            ? `Lista do ERP: ${infoErp.total} produtos (código, preço e saldo), atualizada em ${infoErp.atualizado ? dataHora(infoErp.atualizado) : '—'}.`
            : 'Lista do ERP ainda não importada. Sem ela a busca mostra só o que já saiu em pedidos, sem preço.'}
          {' '}Para atualizar: no ERP, Estoque → Relatórios → Produtos → Exporta para Excel, e escolha o CSV aqui.
        </p>
        <input
          ref={arquivoRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importarLista(f);
          }}
        />
        <Button
          onClick={() => arquivoRef.current?.click()}
          disabled={importando !== null}
          variant="outline"
          className="h-11 shrink-0 border-adm-line bg-adm-surface text-adm-ink hover:bg-adm-accent-soft"
        >
          {importando ?? 'Importar lista do ERP'}
        </Button>
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="mb-4">
        <TabsList className="h-auto flex-wrap bg-adm-surface">
          {ABAS.map((a) => (
            <TabsTrigger key={a.valor} value={a.valor}>
              {a.rotulo} ({lista.filter((o) => o.situacao === a.valor).length})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {erro && <p className="mb-3 text-sm text-red-600">Não consegui carregar: {erro}</p>}

      {carregando ? (
        <AdminLoadingState />
      ) : daAba.length === 0 ? (
        <AdminEmptyState icon={FileText} title="Nada por aqui" description="Quando houver orçamentos nesta aba, eles aparecem aqui." />
      ) : (
        <div className="space-y-2">
          {daAba.map((o) => {
            const duvidas = o.itens.filter((i) => i.conferir).length;
            return (
              <button
                key={o.id}
                onClick={() => setEditando(o)}
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-adm-line bg-adm-surface px-4 py-3 text-left hover:bg-adm-accent-soft"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-adm-ink">{o.cliente_nome}</p>
                  <p className="text-xs text-adm-muted">
                    {dataHora(o.created_at)} · {o.itens.length} {o.itens.length === 1 ? 'item' : 'itens'}
                    {o.origem ? ` · ${o.origem}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {duvidas > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                      <AlertTriangle className="h-3 w-3" /> {duvidas} em dúvida
                    </span>
                  )}
                  <span className="text-sm font-semibold text-adm-ink">{o.total != null ? dinheiro(o.total) : 'sem preço'}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrcamentosManager;

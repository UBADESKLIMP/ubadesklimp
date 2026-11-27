import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FileText, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { numeroBR } from '@/lib/pedidoErp';

export interface ItemOrcamento {
  descricao: string;
  unidade: string;
  quantidade: number;
  /** null = sem preço ainda (o sistema só preenche sozinho quando já viu o valor). */
  valor_unitario: number | null;
  /** Dúvida: a pessoa responsável resolve antes de confirmar. */
  conferir: boolean;
  nota: string;
}

export interface OrcamentoRegistro {
  id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  origem: string | null;
  observacao: string | null;
  situacao: 'rascunho' | 'confirmado' | 'cancelado';
  itens: ItemOrcamento[];
  total: number | null;
  created_at: string;
  confirmado_em: string | null;
}

interface Sugestao {
  descricao: string;
  unidade: string | null;
  vendas: number;
  ultima: string;
  ultimo_preco: number | null;
}

export const dinheiro = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const totalDoOrcamento = (itens: ItemOrcamento[]) =>
  itens.reduce((s, i) => s + (i.valor_unitario != null ? i.valor_unitario * i.quantidade : 0), 0);

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const dataCurta = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const CAMPO = 'border-adm-line bg-adm-surface text-adm-ink';

interface Props {
  empresaId: string;
  orcamento: OrcamentoRegistro | null;
  onVoltar: () => void;
  onSalvou: () => void;
}

const OrcamentoEditor = ({ empresaId, orcamento, onVoltar, onSalvou }: Props) => {
  const { toast } = useToast();
  const somenteLeitura = orcamento != null && orcamento.situacao !== 'rascunho';

  const [cliente, setCliente] = useState(orcamento?.cliente_nome ?? '');
  const [telefone, setTelefone] = useState(orcamento?.cliente_telefone ?? '');
  const [origem, setOrigem] = useState(orcamento?.origem ?? 'WhatsApp');
  const [observacao, setObservacao] = useState(orcamento?.observacao ?? '');
  const [itens, setItens] = useState<ItemOrcamento[]>(orcamento?.itens ?? []);
  const [precoTexto, setPrecoTexto] = useState<Record<number, string>>({});
  const [salvando, setSalvando] = useState(false);

  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const pedido = useRef(0);

  // Busca com pausa: cada letra não dispara uma consulta.
  useEffect(() => {
    if (somenteLeitura) return;
    const meu = ++pedido.current;
    const t = setTimeout(async () => {
      setBuscando(true);
      const { data, error } = await supabase.rpc('orcamento_buscar_itens', {
        p_empresa_id: empresaId,
        p_busca: semAcento(busca),
        p_limite: 12,
      });
      if (meu !== pedido.current) return;
      setBuscando(false);
      setSugestoes(error ? [] : (data ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [busca, empresaId, somenteLeitura]);

  const adicionar = (s: Sugestao | null) => {
    const descricao = (s?.descricao ?? busca).trim().toUpperCase();
    if (!descricao) return;
    setItens((atual) => [
      ...atual,
      {
        descricao,
        unidade: s?.unidade ?? 'UN',
        quantidade: 1,
        valor_unitario: s?.ultimo_preco ?? null,
        // Item digitado à mão (não saiu em nenhuma venda): nasce marcado como dúvida.
        conferir: s == null,
        nota: s == null ? 'Não saiu em venda recente; ver se existe.' : '',
      },
    ]);
    setBusca('');
  };

  const mudar = (i: number, parte: Partial<ItemOrcamento>) =>
    setItens((atual) => atual.map((it, k) => (k === i ? { ...it, ...parte } : it)));

  const remover = (i: number) => {
    setItens((atual) => atual.filter((_, k) => k !== i));
    setPrecoTexto({});
  };

  const total = useMemo(() => totalDoOrcamento(itens), [itens]);
  const semPreco = itens.filter((i) => i.valor_unitario == null).length;
  const duvidas = itens.filter((i) => i.conferir).length;

  const gravar = async (situacao: 'rascunho' | 'confirmado' | 'cancelado') => {
    if (!cliente.trim()) {
      toast({ title: 'Falta o nome do cliente', variant: 'destructive' });
      return;
    }
    if (itens.length === 0) {
      toast({ title: 'Coloque pelo menos um item', variant: 'destructive' });
      return;
    }
    if (situacao === 'confirmado' && duvidas > 0) {
      toast({
        title: `Ainda tem ${duvidas} ${duvidas === 1 ? 'item em dúvida' : 'itens em dúvida'}`,
        description: 'Resolva e desmarque a dúvida antes de confirmar.',
        variant: 'destructive',
      });
      return;
    }
    setSalvando(true);
    const campos = {
      empresa_id: empresaId,
      cliente_nome: cliente.trim(),
      cliente_telefone: telefone.trim() || null,
      origem: origem.trim() || null,
      observacao: observacao.trim() || null,
      situacao,
      itens: itens as unknown as Json,
      total: semPreco === itens.length ? null : total,
      confirmado_em: situacao === 'confirmado' ? new Date().toISOString() : null,
    };
    const { error } = orcamento
      ? await supabase.from('orcamentos').update(campos).eq('id', orcamento.id)
      : await supabase.from('orcamentos').insert(campos);
    setSalvando(false);
    if (error) {
      toast({ title: 'Não consegui salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title:
        situacao === 'confirmado'
          ? 'Orçamento confirmado'
          : situacao === 'cancelado'
            ? 'Orçamento cancelado'
            : 'Rascunho salvo',
    });
    onSalvou();
  };

  const reabrir = async () => {
    if (!orcamento) return;
    setSalvando(true);
    const { error } = await supabase
      .from('orcamentos')
      .update({ situacao: 'rascunho', confirmado_em: null })
      .eq('id', orcamento.id);
    setSalvando(false);
    if (error) {
      toast({ title: 'Não consegui reabrir', description: error.message, variant: 'destructive' });
      return;
    }
    onSalvou();
  };

  return (
    <div className="space-y-5">
      <button
        onClick={onVoltar}
        className="inline-flex items-center gap-2 text-sm text-adm-muted hover:text-adm-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para os orçamentos
      </button>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-adm-muted">Cliente</label>
          <Input value={cliente} onChange={(e) => setCliente(e.target.value)} disabled={somenteLeitura} className={CAMPO} placeholder="Nome ou empresa" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-adm-muted">Telefone</label>
          <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} disabled={somenteLeitura} className={CAMPO} inputMode="tel" placeholder="(12) 9...." />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-adm-muted">Veio por</label>
          <Input value={origem} onChange={(e) => setOrigem(e.target.value)} disabled={somenteLeitura} className={CAMPO} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-adm-muted">Observação</label>
          <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} disabled={somenteLeitura} className={CAMPO} placeholder="Ex.: lista do PDF de 25/11, entregar na sexta" />
        </div>
      </div>

      {!somenteLeitura && (
        <div className="relative">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-faint" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className={`${CAMPO} h-12 pl-10`}
              placeholder="Buscar item (ex.: cloro vmax, desinfetante 5 lt, veja multiuso)"
            />
          </div>
          <div className="mt-2 overflow-hidden rounded-xl border border-adm-line bg-adm-surface">
            {sugestoes.length === 0 && !buscando && (
              <p className="px-4 py-3 text-sm text-adm-muted">Nenhum item vendido com esse nome.</p>
            )}
            {sugestoes.map((s) => (
              <button
                key={s.descricao}
                onClick={() => adicionar(s)}
                className="flex w-full items-center justify-between gap-3 border-b border-adm-line px-4 py-2.5 text-left last:border-b-0 hover:bg-adm-accent-soft"
              >
                <span className="min-w-0 text-sm text-adm-ink">{s.descricao}</span>
                <span className="shrink-0 text-xs text-adm-muted">
                  {s.vendas}x · última {dataCurta(s.ultima)}
                  {s.ultimo_preco != null && ` · ${dinheiro(s.ultimo_preco)}`}
                </span>
              </button>
            ))}
            {busca.trim().length > 2 && (
              <button
                onClick={() => adicionar(null)}
                className="flex w-full items-center gap-2 border-t border-adm-line bg-adm-bg px-4 py-2.5 text-left text-sm text-adm-ink hover:bg-adm-accent-soft"
              >
                <Plus className="h-4 w-4" /> Adicionar “{busca.trim().toUpperCase()}” mesmo assim (fica em dúvida)
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {itens.length === 0 && (
          <p className="rounded-xl border border-dashed border-adm-line px-4 py-8 text-center text-sm text-adm-muted">
            Nenhum item ainda. Busque acima para montar a OR.
          </p>
        )}
        {itens.map((it, i) => (
          <div
            key={i}
            className={`rounded-xl border px-3 py-3 ${it.conferir ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-500/10' : 'border-adm-line bg-adm-surface'}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Input value={it.descricao} onChange={(e) => mudar(i, { descricao: e.target.value.toUpperCase() })} disabled={somenteLeitura} className={`${CAMPO} min-w-[220px] flex-1`} />
              <Input
                type="number"
                min={0}
                value={it.quantidade}
                onChange={(e) => mudar(i, { quantidade: Math.max(0, Number(e.target.value) || 0) })}
                disabled={somenteLeitura}
                className={`${CAMPO} w-20`}
                aria-label="Quantidade"
              />
              <Input value={it.unidade} onChange={(e) => mudar(i, { unidade: e.target.value.toUpperCase() })} disabled={somenteLeitura} className={`${CAMPO} w-16`} aria-label="Unidade" />
              <Input
                value={precoTexto[i] ?? (it.valor_unitario != null ? String(it.valor_unitario).replace('.', ',') : '')}
                onChange={(e) => {
                  setPrecoTexto((p) => ({ ...p, [i]: e.target.value }));
                  mudar(i, { valor_unitario: numeroBR(e.target.value) });
                }}
                disabled={somenteLeitura}
                inputMode="decimal"
                placeholder="sem preço"
                className={`${CAMPO} w-28`}
                aria-label="Valor unitário"
              />
              <span className="w-24 text-right text-sm font-medium text-adm-ink">
                {it.valor_unitario != null ? dinheiro(it.valor_unitario * it.quantidade) : '—'}
              </span>
              {!somenteLeitura && (
                <>
                  <button
                    onClick={() => mudar(i, { conferir: !it.conferir })}
                    title={it.conferir ? 'Resolvido: tirar a dúvida' : 'Marcar como dúvida'}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border ${it.conferir ? 'border-amber-500 text-amber-600' : 'border-adm-line text-adm-faint hover:text-adm-ink'}`}
                  >
                    {it.conferir ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => remover(i)}
                    title="Tirar o item"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-adm-line text-adm-faint hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            {(it.conferir || it.nota) && (
              <Textarea
                value={it.nota}
                onChange={(e) => mudar(i, { nota: e.target.value })}
                disabled={somenteLeitura}
                rows={1}
                placeholder="O que conferir neste item"
                className={`${CAMPO} mt-2 min-h-0 text-sm`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-adm-line bg-adm-surface px-4 py-3">
        <div className="text-sm text-adm-muted">
          {itens.length} {itens.length === 1 ? 'item' : 'itens'}
          {semPreco > 0 && <> · <span className="text-amber-600">{semPreco} sem preço</span></>}
          {duvidas > 0 && <> · <span className="text-amber-600">{duvidas} em dúvida</span></>}
        </div>
        <div className="text-lg font-semibold text-adm-ink">
          {semPreco === itens.length ? '—' : dinheiro(total)}
          {semPreco > 0 && semPreco < itens.length && <span className="ml-2 text-xs font-normal text-adm-muted">(só dos itens com preço)</span>}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {somenteLeitura ? (
          <Button onClick={reabrir} disabled={salvando} variant="outline" className="h-11 border-adm-line bg-adm-surface text-adm-ink">
            Reabrir como rascunho
          </Button>
        ) : (
          <>
            {orcamento && (
              <Button onClick={() => gravar('cancelado')} disabled={salvando} variant="outline" className="h-11 border-adm-line bg-adm-surface text-adm-ink">
                Cancelar orçamento
              </Button>
            )}
            <Button onClick={() => gravar('rascunho')} disabled={salvando} variant="outline" className="h-11 border-adm-line bg-adm-surface text-adm-ink">
              Salvar rascunho
            </Button>
            <Button onClick={() => gravar('confirmado')} disabled={salvando} className="h-11 bg-adm-accent text-white hover:bg-adm-accent/90">
              Confirmar orçamento
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default OrcamentoEditor;

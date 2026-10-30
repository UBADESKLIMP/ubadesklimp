import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, History, Undo2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import {
  MOTIVO_LABEL,
  emReais,
  hojeEmSaoPaulo,
  useHistoricoDeEntregas,
  type RegistroDoHistorico,
} from '@/hooks/useEntregas';
import { normalizeText } from '@/lib/utils';

const CARD = 'bg-adm-surface border-adm-line text-adm-ink shadow-sm';
const CAMPO = 'h-10 rounded-md border border-adm-line bg-adm-bg px-3 text-sm text-adm-ink';

/** Soma (ou subtrai) dias de uma data YYYY-MM-DD sem depender do fuso do navegador. */
const somarDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const tituloDoDia = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  const semana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(d);
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
};

const Atalho = ({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={`h-10 rounded-md border px-3 text-sm transition-colors ${
      ativo
        ? 'border-adm-accent bg-adm-accent-soft font-semibold text-adm-accent'
        : 'border-adm-line bg-adm-bg text-adm-muted hover:text-adm-ink'
    }`}
  >
    {children}
  </button>
);

/**
 * Tudo que o entregador registrou, por dia, para consultar no futuro quem levou
 * o quê e quando. Mostra também as vezes que voltou sem entregar, com o motivo.
 */
const HistoricoEntregas = ({ empresaId }: { empresaId: string | null }) => {
  const hoje = hojeEmSaoPaulo();
  const [de, setDe] = useState(() => somarDias(hoje, -29));
  const [ate, setAte] = useState(hoje);
  const [entregador, setEntregador] = useState('');
  const [busca, setBusca] = useState('');

  const { registros, carregando, erro } = useHistoricoDeEntregas(empresaId, de, ate);

  const entregadores = useMemo(
    () => [...new Set(registros.map((r) => r.entregador))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [registros]
  );

  const filtrados = useMemo(() => {
    const termo = normalizeText(busca.trim());
    return registros.filter(
      (r) =>
        (!entregador || r.entregador === entregador) &&
        (!termo ||
          normalizeText(`${r.cliente_nome} ${r.documento} ${r.bairro ?? ''} ${r.endereco ?? ''}`).includes(termo))
    );
  }, [registros, entregador, busca]);

  const dias = useMemo(() => {
    const porDia = new Map<string, RegistroDoHistorico[]>();
    filtrados.forEach((r) => porDia.set(r.dia, [...(porDia.get(r.dia) ?? []), r]));
    return [...porDia.entries()];
  }, [filtrados]);

  // Marcação desfeita pelo escritório e a própria reversão não contam como entrega.
  const vale = (r: RegistroDoHistorico) => r.tipo !== 'revertida' && !r.desfeita;
  const entregues = filtrados.filter((r) => r.tipo === 'entregue' && vale(r));
  const voltaram = filtrados.filter((r) => r.tipo === 'nao_entregue' && vale(r)).length;
  const totalEntregue = entregues.reduce((soma, r) => soma + (r.valor ?? 0), 0);

  const escolher = (dias: number) => {
    setDe(somarDias(hoje, -dias));
    setAte(hoje);
  };
  const primeiroDoMes = `${hoje.slice(0, 8)}01`;

  return (
    <div className="space-y-4">
      <Card className={CARD}>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs text-adm-muted">
              De
              <input type="date" value={de} max={ate} onChange={(e) => e.target.value && setDe(e.target.value)} className={`${CAMPO} block`} />
            </label>
            <label className="space-y-1 text-xs text-adm-muted">
              Até
              <input type="date" value={ate} min={de} max={hoje} onChange={(e) => e.target.value && setAte(e.target.value)} className={`${CAMPO} block`} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Atalho ativo={de === hoje && ate === hoje} onClick={() => escolher(0)}>Hoje</Atalho>
              <Atalho ativo={de === somarDias(hoje, -6) && ate === hoje} onClick={() => escolher(6)}>7 dias</Atalho>
              <Atalho ativo={de === somarDias(hoje, -29) && ate === hoje} onClick={() => escolher(29)}>30 dias</Atalho>
              <Atalho
                ativo={de === primeiroDoMes && ate === hoje}
                onClick={() => {
                  setDe(primeiroDoMes);
                  setAte(hoje);
                }}
              >
                Este mês
              </Atalho>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <select value={entregador} onChange={(e) => setEntregador(e.target.value)} className={CAMPO} aria-label="Entregador">
              <option value="">Todos os entregadores</option>
              {entregadores.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente, pedido ou bairro"
              className="h-10 max-w-xs border-adm-line bg-adm-bg text-adm-ink"
            />
            {(entregador || busca) && (
              <Button
                variant="ghost"
                className="h-10 text-adm-muted"
                onClick={() => {
                  setEntregador('');
                  setBusca('');
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {carregando && registros.length === 0 ? (
        <AdminLoadingState label="Carregando o histórico..." />
      ) : erro ? (
        <AdminEmptyState icon={AlertTriangle} title="Não foi possível carregar o histórico" description={erro} />
      ) : filtrados.length === 0 ? (
        <AdminEmptyState
          icon={History}
          title="Nenhuma entrega neste período"
          description="Mude as datas ou tire os filtros. Aqui aparece tudo que o entregador marcou no celular."
        />
      ) : (
        <>
          <p className="text-sm text-adm-muted">
            <span className="font-mono tabular-nums text-adm-ink">{entregues.length}</span> entregues
            {voltaram > 0 && (
              <>
                {' · '}
                <span className="font-mono tabular-nums text-[#C0392B]">{voltaram}</span> voltaram
              </>
            )}
            {' · '}
            <span className="font-mono tabular-nums text-adm-ink">{emReais(totalEntregue)}</span> em pedidos entregues
          </p>

          {dias.map(([dia, doDia]) => {
            const feitas = doDia.filter((r) => r.tipo === 'entregue' && vale(r)).length;
            const voltouNoDia = doDia.filter((r) => r.tipo === 'nao_entregue' && vale(r)).length;
            return (
              <Card key={dia} className={CARD}>
                <CardContent className="pt-5">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="text-base font-semibold text-adm-ink">{tituloDoDia(dia)}</h3>
                    <span className="text-xs text-adm-muted">
                      <span className="font-mono tabular-nums">{feitas}</span> entregue{feitas === 1 ? '' : 's'}
                      {voltouNoDia > 0 && (
                        <>
                          {' · '}
                          <span className="font-mono tabular-nums">{voltouNoDia}</span> voltou
                        </>
                      )}
                    </span>
                  </div>
                  <ul className="divide-y divide-adm-line">
                    {doDia.map((r) => {
                      const entregue = r.tipo === 'entregue';
                      const revertida = r.tipo === 'revertida';
                      const Icone = revertida ? Undo2 : entregue ? CheckCircle2 : XCircle;
                      return (
                        <li key={r.evento_id} className={`flex items-start gap-3 py-3 ${r.desfeita ? 'opacity-55' : ''}`}>
                          <span className="w-12 shrink-0 pt-0.5 font-mono text-sm tabular-nums text-adm-muted">{r.hora}</span>
                          <Icone
                            className={`mt-0.5 h-5 w-5 shrink-0 ${
                              revertida ? 'text-[#B8860B]' : entregue ? 'text-[#2F9E44]' : 'text-[#C0392B]'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-adm-ink">{r.cliente_nome}</p>
                            <p className="truncate text-sm text-adm-muted">
                              {[r.documento, r.bairro, r.endereco].filter(Boolean).join(' · ')}
                            </p>
                            {revertida ? (
                              <p className="text-sm text-adm-muted">
                                Voltou para a rota, desfeito por <span className="text-adm-ink">{r.entregador}</span>
                              </p>
                            ) : (
                              <p className="text-sm text-adm-muted">
                                {entregue ? 'Entregue' : 'Voltou'} por <span className="text-adm-ink">{r.entregador}</span>
                                {entregue && r.quem_recebeu && <> · recebeu {r.quem_recebeu}</>}
                                {!entregue && r.motivo && <> · {MOTIVO_LABEL[r.motivo]}</>}
                                {!entregue && r.motivo_texto && <> ({r.motivo_texto})</>}
                                {r.desfeita && <span className="ml-2 rounded bg-adm-line px-1.5 py-0.5 text-xs">desfeita</span>}
                              </p>
                            )}
                            {r.itens.length > 0 && (
                              <details className="mt-1 text-sm text-adm-muted">
                                <summary className="cursor-pointer select-none">
                                  {r.itens.length} {r.itens.length === 1 ? 'item' : 'itens'}
                                </summary>
                                <ul className="mt-1 space-y-0.5 pl-4">
                                  {r.itens.map((item, i) => (
                                    <li key={i}>
                                      <span className="font-mono tabular-nums">{item.quantidade ?? ''}</span>{' '}
                                      {item.unidade ?? ''} {item.descricao ?? ''}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                          <span className="shrink-0 font-mono text-sm tabular-nums text-adm-ink">
                            {revertida ? '' : emReais(r.valor)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
};

export default HistoricoEntregas;

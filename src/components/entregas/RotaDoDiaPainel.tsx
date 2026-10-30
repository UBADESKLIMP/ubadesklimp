import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ArrowDownUp, CheckCircle2, Clock, MapPinned, RefreshCw, Undo2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import SortableParada from './SortableParada';
import { MOTIVO_LABEL, diaCurto, type ParadaDaRota, type ResultadoRpc, type RotaDoDia } from '@/hooks/useEntregas';

const CARD = 'bg-adm-surface border-adm-line text-adm-ink shadow-sm';

interface Props {
  rota: RotaDoDia | null;
  carregando: boolean;
  data: string;
  onInverter: () => Promise<ResultadoRpc>;
  onMover: (nova: ParadaDaRota[]) => Promise<ResultadoRpc>;
  onTirar: (paradaId: string) => Promise<ResultadoRpc>;
  onReverter: (paradaId: string) => Promise<ResultadoRpc>;
  onRecarregar: () => void;
  onIrParaFila: () => void;
}

/**
 * A rota do dia e a tela ao vivo da loja são a mesma coisa: a lista recarrega
 * sozinha a cada 30s. Fazer duas telas com a mesma informação é o tipo de coisa
 * que ninguém mantém — e a segunda sempre fica desatualizada.
 */
const RotaDoDiaPainel = ({
  rota,
  carregando,
  data,
  onInverter,
  onMover,
  onTirar,
  onReverter,
  onRecarregar,
  onIrParaFila,
}: Props) => {
  const [mexendo, setMexendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (carregando && !rota) return <AdminLoadingState label="Carregando a rota..." />;

  if (!rota?.existe) {
    return (
      <AdminEmptyState
        icon={MapPinned}
        title={`Nenhuma rota montada para ${diaCurto(data)}`}
        description="Escolha as entregas na aba Fila e monte a rota. Ela aparece no celular do entregador na hora."
        action={
          <Button onClick={onIrParaFila} className="bg-adm-accent text-adm-on-accent hover:bg-adm-accent-strong">
            Ir para a fila
          </Button>
        }
      />
    );
  }

  const paradas = rota.paradas ?? [];
  const feitas = paradas.filter((p) => p.situacao === 'entregue').length;
  const falharam = paradas.filter((p) => p.situacao === 'nao_entregue').length;
  const faltam = paradas.length - feitas - falharam;
  // A lista de cima é só o que ainda falta entregar. Quem já foi resolvido
  // fica na seção de baixo: misturado, ele assumia o topo ao "Começar pelo fim".
  const pendentes = paradas.filter((p) => p.situacao === 'em_rota');

  const arrastou = async (evento: DragEndEvent) => {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;

    const de = pendentes.findIndex((p) => p.parada_id === active.id);
    const para = pendentes.findIndex((p) => p.parada_id === over.id);
    if (de < 0 || para < 0) return;

    setMexendo(true);
    setAviso(null);
    const r = await onMover(arrayMove(pendentes, de, para));
    setMexendo(false);
    if (!r.ok) setAviso(r.mensagem ?? 'Não conseguimos guardar a nova ordem.');
  };

  const tirar = async (parada: ParadaDaRota) => {
    if (!window.confirm(`Tirar ${parada.cliente_nome} da rota de hoje? Ela volta para a fila.`)) return;
    setMexendo(true);
    setAviso(null);
    const r = await onTirar(parada.parada_id);
    setMexendo(false);
    if (!r.ok) setAviso(r.mensagem ?? 'Não foi possível tirar da rota.');
  };

  const reverter = async (parada: ParadaDaRota) => {
    const o_que = parada.situacao === 'entregue' ? 'como entregue' : 'como não entregue';
    if (!window.confirm(`Voltar ${parada.cliente_nome} para a rota? Ela deixa de contar ${o_que}. O registro do motorista fica no histórico.`)) return;
    setMexendo(true);
    setAviso(null);
    const r = await onReverter(parada.parada_id);
    setMexendo(false);
    if (!r.ok) setAviso(r.mensagem ?? 'Não foi possível reverter.');
  };

  const inverter = async () => {
    setMexendo(true);
    setAviso(null);
    const r = await onInverter();
    setMexendo(false);
    if (!r.ok) setAviso(r.mensagem ?? 'Não conseguimos inverter a rota.');
  };

  const proxima = pendentes[0];
  // Mais recente primeiro: quem olha a tela quer saber o que acabou de acontecer.
  const acontecimentos = paradas
    .filter((p) => p.evento && p.situacao !== 'em_rota')
    .sort((a, b) => (b.evento?.hora ?? '').localeCompare(a.evento?.hora ?? ''));

  return (
    <div className="space-y-4">
      {proxima && (
        <div className="flex items-center gap-4 rounded-xl border border-adm-accent-line bg-adm-accent-soft px-5 py-4">
          <Clock className="h-6 w-6 shrink-0 text-adm-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-adm-accent">Próxima parada</p>
            <p className="truncate text-lg font-semibold text-adm-ink">{proxima.cliente_nome}</p>
            <p className="truncate text-sm text-adm-muted">
              {[proxima.bairro, proxima.entregar_em || proxima.endereco].filter(Boolean).join(' · ') || 'Sem endereço no cadastro'}
            </p>
          </div>
          <span className="font-mono text-2xl font-semibold tabular-nums text-adm-accent">
            01
          </span>
        </div>
      )}

      <Card className={CARD}>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg text-adm-ink">
                Rota de {diaCurto(data)}
                {rota.invertida && ' · do sul para o norte'}
              </CardTitle>
              <p className="mt-1 text-sm text-adm-muted">
                <span className="font-mono tabular-nums">{feitas}</span> de{' '}
                <span className="font-mono tabular-nums">{paradas.length}</span> entregues
                {falharam > 0 && (
                  <>
                    {' '}· <span className="font-mono tabular-nums text-adm-alert">{falharam}</span> voltaram
                  </>
                )}
                {' '}· <span className="font-mono tabular-nums">{faltam}</span> a caminho
              </p>
              {/* Barra do dia: verde o que entregou, vermelho o que voltou, cinza o que falta. */}
              <div
                className="mt-3 flex h-3 w-full max-w-md overflow-hidden rounded-full bg-adm-line"
                role="img"
                aria-label={`${feitas} entregues, ${falharam} voltaram, ${faltam} a caminho`}
              >
                <span className="h-full bg-[#2F9E44] transition-all" style={{ width: `${(feitas / paradas.length) * 100}%` }} />
                <span className="h-full bg-[#C0392B] transition-all" style={{ width: `${(falharam / paradas.length) * 100}%` }} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onRecarregar}
                className="h-11 border-adm-line bg-adm-surface text-adm-ink hover:bg-adm-accent-soft"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
              <Button
                onClick={inverter}
                disabled={mexendo || paradas.length < 2}
                className="h-11 bg-adm-accent text-adm-on-accent hover:bg-adm-accent-strong"
              >
                <ArrowDownUp className="mr-2 h-4 w-4" />
                {rota.invertida ? 'Voltar à ordem normal' : 'Começar pelo fim'}
              </Button>
            </div>
          </div>

          <p className="text-xs text-adm-faint">
            Atualiza sozinha, em poucos segundos. Arraste pelo punho à esquerda para mudar a ordem —
            inverter depois não desfaz o seu arrasto.
          </p>
        </CardHeader>

        <CardContent className="space-y-2">
          {pendentes.length === 0 ? (
            <p className="py-6 text-center text-sm text-adm-muted">
              {paradas.length === 0
                ? 'A rota existe mas está vazia. Escolha as entregas na aba Fila.'
                : 'Nada a caminho: tudo desta rota já foi resolvido. Para mandar mais, escolha na aba Fila.'}
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={arrastou}>
              <SortableContext
                items={pendentes.map((p) => p.parada_id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {pendentes.map((parada, i) => (
                    <SortableParada
                      key={parada.parada_id}
                      parada={parada}
                      posicao={i + 1}
                      podeArrastar
                      onTirar={() => tirar(parada)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {aviso && <p className="text-sm text-adm-alert">{aviso}</p>}
        </CardContent>
      </Card>

      {acontecimentos.length > 0 && (
        <Card className={CARD}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-adm-ink">Já resolvidas hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-4 border-l-2 border-adm-line pl-6">
              {acontecimentos.map((p) => {
                const entregue = p.evento?.tipo === 'entregue';
                const Icone = entregue ? CheckCircle2 : XCircle;
                return (
                  <li key={p.parada_id} className="relative">
                    <span
                      className={`absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full bg-adm-surface ${
                        entregue ? 'text-[#2F9E44]' : 'text-[#C0392B]'
                      }`}
                    >
                      <Icone className="h-5 w-5" />
                    </span>
                    <p className="text-sm text-adm-ink">
                      <span className="font-mono font-semibold tabular-nums">{p.evento?.hora}</span>
                      {' · '}
                      <span className="font-medium">{p.cliente_nome}</span>
                    </p>
                    <p className="text-xs text-adm-muted">
                      {p.evento?.entregador && <>{p.evento.entregador} · </>}
                      {entregue
                        ? p.evento?.quem_recebeu
                          ? `Entregue · recebeu: ${p.evento.quem_recebeu}`
                          : 'Entregue'
                        : `Não entregue${p.evento?.motivo ? ` · ${MOTIVO_LABEL[p.evento.motivo]}` : ''}${
                            p.evento?.motivo_texto ? ` — ${p.evento.motivo_texto}` : ''
                          }`}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={mexendo}
                      onClick={() => reverter(p)}
                      className="mt-1.5 h-8 border-adm-line bg-adm-surface text-xs text-adm-muted hover:text-adm-ink"
                    >
                      <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                      Voltar para a rota
                    </Button>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RotaDoDiaPainel;

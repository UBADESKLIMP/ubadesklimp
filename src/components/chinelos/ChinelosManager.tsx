import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Footprints, MessageCircle, PackageCheck, Printer, QrCode, Trash2, Truck, XCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { htmlDoRelatorio, somarParaEncomenda, type PedidoDeChineloLinha } from '@/lib/relatorioChinelos';

type Status = 'a_confirmar' | 'pendente' | 'encomendado' | 'chegou' | 'entregue' | 'cancelado';

interface Pedido extends PedidoDeChineloLinha {
  status: Status;
  anotado_por: string | null;
  origem: 'funcionario' | 'cliente';
}

type Aba = 'a_confirmar' | 'pendente' | 'encomendado' | 'chegou' | 'historico';

const ABAS: { valor: Aba; rotulo: string; status: Status[] }[] = [
  { valor: 'a_confirmar', rotulo: 'A confirmar', status: ['a_confirmar'] },
  { valor: 'pendente', rotulo: 'Para encomendar', status: ['pendente'] },
  { valor: 'encomendado', rotulo: 'Encomendados', status: ['encomendado'] },
  { valor: 'chegou', rotulo: 'Chegaram', status: ['chegou'] },
  { valor: 'historico', rotulo: 'Histórico', status: ['entregue', 'cancelado'] },
];

const CARD = 'bg-adm-surface border-adm-line text-adm-ink shadow-sm';

const dataHora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));

const SEGUNDOS_ENTRE_RECARGAS = 20;
const LINK_PEDIDO_CLIENTE = 'https://ubadesklimp.com/chinelo';

/**
 * Pedidos de chinelo Havaianas anotados no quiosque. O escritório imprime o
 * relatório para quem encomenda, marca como encomendado, e quando o chinelo
 * chega avisa o cliente pelo WhatsApp. Cada pedido é um par.
 */
const ChinelosManager = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>('pendente');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [qrAberto, setQrAberto] = useState(false);
  const [qrImagem, setQrImagem] = useState<string | null>(null);

  useEffect(() => {
    if (!qrAberto || qrImagem) return;
    QRCode.toDataURL(LINK_PEDIDO_CLIENTE, { width: 640, margin: 2, errorCorrectionLevel: 'M' })
      .then(setQrImagem)
      .catch(() => setErro('Não foi possível gerar o QR.'));
  }, [qrAberto, qrImagem]);

  const imprimirQr = () => {
    if (!qrImagem) return;
    const janela = window.open('', '_blank');
    if (!janela) {
      setErro('O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.');
      return;
    }
    janela.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR pedido de chinelo</title>
<style>body{font-family:Arial,sans-serif;text-align:center;margin:0;padding:40px}h1{font-size:44px;margin:0 0 8px}p{font-size:22px;margin:6px 0;color:#333}img{width:420px;height:420px;margin:24px auto;display:block}</style></head>
<body><h1>Quer um chinelo que não temos?</h1><p>Aponte a câmera do celular e faça seu pedido.</p><img src="${qrImagem}" alt="QR code"/><p><b>Ubadesklimp</b> · avisamos quando chegar</p></body></html>`);
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 400);
  };

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('chinelo_pedidos')
      .select('id, cliente_nome, cliente_telefone, numero, cor, observacao, status, anotado_por, origem, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      setErro('Não foi possível carregar os pedidos. Tente de novo em instantes.');
    } else {
      setErro(null);
      setPedidos((data ?? []) as Pedido[]);
    }
    setCarregando(false);
  }, []);

  // O funcionário anota no quiosque; o pedido novo aparece aqui sozinho.
  useEffect(() => {
    carregar();
    const aCada = () => {
      if (document.visibilityState === 'visible') carregar();
    };
    const t = setInterval(aCada, SEGUNDOS_ENTRE_RECARGAS * 1000);
    document.addEventListener('visibilitychange', aCada);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', aCada);
    };
  }, [carregar]);

  const daAba = useMemo(() => {
    const aceitos = ABAS.find((a) => a.valor === aba)?.status ?? [];
    return pedidos.filter((p) => aceitos.includes(p.status));
  }, [pedidos, aba]);

  const contagem = (valor: Aba) => {
    const aceitos = ABAS.find((a) => a.valor === valor)?.status ?? [];
    return pedidos.filter((p) => aceitos.includes(p.status)).length;
  };

  const mudarStatus = async (ids: string[], status: Status) => {
    setOcupado(ids.length === 1 ? ids[0] : 'lote');
    setErro(null);
    const { error } = await supabase.from('chinelo_pedidos').update({ status }).in('id', ids);
    setOcupado(null);
    if (error) {
      setErro('Não foi possível atualizar. Tente de novo.');
      return;
    }
    setPedidos((atual) => atual.map((p) => (ids.includes(p.id) ? { ...p, status } : p)));
  };

  const excluir = async (p: Pedido) => {
    if (!window.confirm(`Apagar o pedido de ${p.cliente_nome} (nº ${p.numero}, ${p.cor})? Isso não dá para desfazer.`)) return;
    setOcupado(p.id);
    const { error } = await supabase.from('chinelo_pedidos').delete().eq('id', p.id);
    setOcupado(null);
    if (error) {
      setErro('Não foi possível apagar. Tente de novo.');
      return;
    }
    setPedidos((atual) => atual.filter((x) => x.id !== p.id));
  };

  // O relatório abre numa janela própria e já chama a impressão.
  const imprimir = (lista: Pedido[], titulo: string) => {
    const hojeTexto = new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date());
    const janela = window.open('', '_blank');
    if (!janela) {
      setErro('O navegador bloqueou a janela do relatório. Libere pop-ups para este site e tente de novo.');
      return;
    }
    janela.document.write(htmlDoRelatorio(titulo, lista, hojeTexto));
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 400);
  };

  const encomendarTodos = async () => {
    const ids = daAba.map((p) => p.id);
    if (ids.length === 0) return;
    if (!window.confirm(`Marcar os ${ids.length} pedidos como encomendados?`)) return;
    await mudarStatus(ids, 'encomendado');
  };

  const resumo = useMemo(() => somarParaEncomenda(daAba), [daAba]);
  const tituloDoRelatorio =
    aba === 'a_confirmar'
      ? 'Chinelos Havaianas — pedidos de clientes a confirmar'
      : aba === 'pendente'
      ? 'Pedido de chinelos Havaianas — para encomendar'
      : aba === 'encomendado'
        ? 'Chinelos Havaianas — já encomendados'
        : aba === 'chegou'
          ? 'Chinelos Havaianas — chegaram'
          : 'Chinelos Havaianas — histórico';

  return (
    <div>
      <AdminPageHeader
        icon={Footprints}
        title="Chinelos"
        description="O que os clientes pediram e a loja não tinha: número e cor. Anotado no quiosque, encomendado por aqui."
        action={
          <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setQrAberto((v) => !v)}
            className="border-adm-line bg-adm-surface text-adm-ink hover:bg-adm-accent-soft"
          >
            <QrCode className="mr-2 h-4 w-4" />
            QR para o cliente pedir
          </Button>
          <Button
            onClick={() => imprimir(daAba, tituloDoRelatorio)}
            disabled={daAba.length === 0}
            className="bg-adm-accent text-adm-on-accent hover:bg-adm-accent-strong"
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir relatório
          </Button>
          </div>
        }
      />

      {qrAberto && (
        <Card className={`${CARD} mb-4`}>
          <CardContent className="flex flex-wrap items-center gap-6 pt-6">
            {qrImagem ? (
              <img src={qrImagem} alt="QR code do pedido de chinelo" className="h-40 w-40 rounded-lg bg-white p-1" />
            ) : (
              <div className="h-40 w-40 rounded-lg bg-adm-bg" />
            )}
            <div className="min-w-[14rem] flex-1 space-y-2">
              <p className="text-sm font-semibold">Cliente escaneia e pede sozinho</p>
              <p className="text-sm text-adm-muted">
                O pedido chega no quiosque como "a confirmar": um funcionário aceita ou recusa lá mesmo. Também aparece
                aqui, na aba A confirmar.
              </p>
              <p className="break-all font-mono text-xs text-adm-faint">{LINK_PEDIDO_CLIENTE}</p>
              <Button
                onClick={imprimirQr}
                disabled={!qrImagem}
                className="bg-adm-accent text-adm-on-accent hover:bg-adm-accent-strong"
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimir QR para o balcão
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
        <TabsList className="h-auto flex-wrap bg-adm-surface border border-adm-line">
          {ABAS.map((a) => (
            <TabsTrigger key={a.valor} value={a.valor}>
              {a.rotulo}
              {contagem(a.valor) > 0 && ` (${contagem(a.valor)})`}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {erro && <p className="mt-4 text-sm text-adm-alert">{erro}</p>}

      {carregando ? (
        <div className="mt-4">
          <AdminLoadingState label="Carregando os pedidos..." />
        </div>
      ) : daAba.length === 0 ? (
        <AdminEmptyState
          icon={Footprints}
          title={aba === 'pendente' ? 'Nenhum pedido esperando' : 'Nada por aqui'}
          description={
            aba === 'pendente'
              ? 'Quando um funcionário anotar um pedido no quiosque (botão "Pedir chinelo"), ele aparece aqui.'
              : undefined
          }
        />
      ) : (
        <div className="mt-4 space-y-4">
          {aba === 'pendente' && (
            <Card className={CARD}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold">
                    O que encomendar:{' '}
                    <span className="font-mono tabular-nums">
                      {daAba.length} {daAba.length === 1 ? 'par' : 'pares'}
                    </span>
                  </p>
                  <Button
                    onClick={encomendarTodos}
                    disabled={ocupado !== null}
                    variant="outline"
                    className="border-adm-line bg-adm-surface text-adm-ink hover:bg-adm-accent-soft"
                  >
                    <Truck className="mr-2 h-4 w-4" />
                    Marcar todos como encomendados
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {resumo.map((l) => (
                    <span
                      key={`${l.numero}-${l.cor}`}
                      className="rounded-lg border border-adm-line bg-adm-bg px-3 py-1.5 text-sm"
                    >
                      <span className="font-mono font-semibold tabular-nums">{l.quantidade}×</span> nº {l.numero} · {l.cor}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <ul className="space-y-2">
            {daAba.map((p) => (
              <li key={p.id}>
                <Card className={CARD}>
                  <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                    <div className="min-w-[10rem] flex-1">
                      <p className="font-semibold">{p.cliente_nome}</p>
                      <p className="text-sm text-adm-muted">
                        {p.cliente_telefone} · {p.origem === 'cliente' ? 'pedido pelo cliente' : 'anotado'} {dataHora(p.created_at)}
                      </p>
                      {p.observacao && <p className="mt-0.5 text-xs text-adm-faint">{p.observacao}</p>}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-adm-accent-soft px-3 py-1.5 font-mono text-sm font-semibold tabular-nums text-adm-accent">
                        nº {p.numero}
                      </span>
                      <span className="rounded-lg border border-adm-line px-3 py-1.5 text-sm">{p.cor}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {p.status === 'a_confirmar' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={ocupado !== null}
                          onClick={() => mudarStatus([p.id], 'pendente')}
                          className="border-adm-line bg-adm-surface text-adm-ink hover:bg-adm-accent-soft"
                        >
                          <Check className="mr-1.5 h-4 w-4" />
                          Confirmar
                        </Button>
                      )}
                      {p.status === 'pendente' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={ocupado !== null}
                          onClick={() => mudarStatus([p.id], 'encomendado')}
                          className="border-adm-line bg-adm-surface text-adm-ink hover:bg-adm-accent-soft"
                        >
                          <Truck className="mr-1.5 h-4 w-4" />
                          Encomendei
                        </Button>
                      )}
                      {p.status === 'encomendado' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={ocupado !== null}
                          onClick={() => mudarStatus([p.id], 'chegou')}
                          className="border-adm-line bg-adm-surface text-adm-ink hover:bg-adm-accent-soft"
                        >
                          <PackageCheck className="mr-1.5 h-4 w-4" />
                          Chegou
                        </Button>
                      )}
                      {p.status === 'chegou' && (
                        <>
                          <a
                            href={buildWhatsAppLink(
                              p.cliente_telefone,
                              `Olá ${p.cliente_nome.split(' ')[0]}! O seu chinelo Havaianas nº ${p.numero} (${p.cor}) chegou na Ubadesklimp. Pode vir buscar quando quiser.`
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-adm-line px-3 text-sm font-medium text-adm-ink hover:bg-adm-accent-soft"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Avisar no WhatsApp
                          </a>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={ocupado !== null}
                            onClick={() => mudarStatus([p.id], 'entregue')}
                            className="border-adm-line bg-adm-surface text-adm-ink hover:bg-adm-accent-soft"
                          >
                            <CheckCircle2 className="mr-1.5 h-4 w-4" />
                            Entregue
                          </Button>
                        </>
                      )}
                      {(p.status === 'entregue' || p.status === 'cancelado') && (
                        <span className="text-xs font-semibold uppercase tracking-wide text-adm-muted">
                          {p.status === 'entregue' ? 'Entregue' : 'Cancelado'}
                        </span>
                      )}
                      {(p.status === 'a_confirmar' || p.status === 'pendente' || p.status === 'encomendado') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={ocupado !== null}
                          onClick={() => mudarStatus([p.id], 'cancelado')}
                          className="text-adm-muted hover:text-adm-alert"
                          title={p.status === 'a_confirmar' ? 'Recusar este pedido' : 'O cliente desistiu'}
                        >
                          <XCircle className="mr-1.5 h-4 w-4" />
                          {p.status === 'a_confirmar' ? 'Recusar' : 'Cancelar'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={ocupado !== null}
                        onClick={() => excluir(p)}
                        className="text-adm-faint hover:text-adm-alert"
                        aria-label="Apagar pedido"
                        title="Apagar de vez"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ChinelosManager;

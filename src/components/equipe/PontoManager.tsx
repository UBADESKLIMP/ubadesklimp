import { useMemo, useState } from 'react';
import {
  Clock,
  Plus,
  Loader2,
  Monitor,
  Wifi,
  AlertTriangle,
  KeyRound,
  ShieldAlert,
  Users,
  Coffee,
  UtensilsCrossed,
  LogOut,
  CircleDashed,
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminStatCard from '@/components/admin/AdminStatCard';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useEquipeAccess } from '@/hooks/useEquipeAccess';
import PontoQrLocais from './PontoQrLocais';
import LancarMarcacaoDialog from './LancarMarcacaoDialog';
import { lerTokenEstacao, retrancarQuiosque } from '@/hooks/usePontoQuiosque';
import {
  usePontoAgora,
  usePontoDoDia,
  usePontoInfra,
  usePontoQrEDispositivos,
  usePausasCafe,
  usePinManutencao,
  hojeISO,
  MOTIVO_LABEL,
  TIPO_LABEL,
  type SituacaoAgora,
} from '@/hooks/usePonto';

const CARD = 'bg-[#12121a] border-blue-500/20 text-white';

const SITUACAO_ESTILO: Record<SituacaoAgora['situacao'], { cor: string; icone: typeof Clock }> = {
  'na loja': { cor: 'bg-[#2F9E44] text-white', icone: Users },
  'em almoço': { cor: 'bg-[#f0b429] text-[#141B1E]', icone: UtensilsCrossed },
  'em pausa': { cor: 'bg-[#6B7280] text-white', icone: Coffee },
  saiu: { cor: 'bg-[#1f2937] text-blue-300/70', icone: LogOut },
  'não chegou': { cor: 'bg-transparent text-blue-300/50 border border-blue-500/20', icone: CircleDashed },
};

/** Selo-carimbo: mesma assinatura visual dos status do módulo Equipe. */
const SeloSituacao = ({ situacao }: { situacao: SituacaoAgora['situacao'] }) => {
  const { cor, icone: Icone } = SITUACAO_ESTILO[situacao];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide -rotate-1',
        cor
      )}
    >
      <Icone className="h-3 w-3" />
      {situacao}
    </span>
  );
};

const horaDe = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

const quandoDe = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const PontoManager = () => {
  const equipeAccess = useEquipeAccess();
  const [dia, setDia] = useState(hojeISO());

  const empresaAtiva = equipeAccess.empresaIds[0] ?? null;

  const { pessoas, loading: loadingAgora } = usePontoAgora(empresaAtiva);
  const { marcacoes, pessoas: pessoasDaEmpresa, loading: loadingDia, lancarMarcacao } =
    usePontoDoDia(empresaAtiva, dia);
  const {
    estacoes,
    redes,
    tentativas,
    semEmpresa,
    loading: loadingInfra,
    revogarEstacao,
    alternarRede,
    liberarRedeAtual,
    prepararEstacao,
  } =
    usePontoInfra(empresaAtiva);
  const qrEDispositivos = usePontoQrEDispositivos(empresaAtiva);
  const pausasCafe = usePausasCafe(empresaAtiva);
  const pinManutencao = usePinManutencao(empresaAtiva);
  const [novoPin, setNovoPin] = useState('');
  const [salvandoPin, setSalvandoPin] = useState(false);
  const [erroPin, setErroPin] = useState<string | null>(null);

  const contagem = useMemo(() => {
    const por = (s: SituacaoAgora['situacao']) => pessoas.filter((p) => p.situacao === s).length;
    return {
      naLoja: por('na loja'),
      almoco: por('em almoço') + por('em pausa'),
      naoChegou: por('não chegou'),
    };
  }, [pessoas]);

  // Só mostra o caminho de volta no navegador que realmente é a estação.
  const esteEhUmQuiosque = Boolean(lerTokenEstacao());
  const [liberandoRede, setLiberandoRede] = useState(false);
  const [avisoRede, setAvisoRede] = useState<string | null>(null);
  const [lancando, setLancando] = useState(false);
  const [nomeNovaEstacao, setNomeNovaEstacao] = useState('PC da frente');
  const [preparando, setPreparando] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [erroCodigo, setErroCodigo] = useState<string | null>(null);

  const gerarCodigo = async () => {
    setErroCodigo(null);
    setPreparando(true);
    const r = await prepararEstacao(nomeNovaEstacao.trim() || 'PC da frente');
    setPreparando(false);
    if (r.ok && r.codigo) setCodigo(r.codigo);
    else setErroCodigo(r.mensagem ?? 'Não foi possível gerar o código.');
  };

  const estacoesAtivas = estacoes.filter((e) => !e.revogada_em);
  const redesAtivas = redes.filter((r) => r.ativo);

  // Duas travas de verdade, nessa ordem: sem rede liberada toda batida é
  // recusada (inclusive pelo QR), e sem estação não existe onde bater no balcão.
  const pendencias: { chave: string; titulo: string; como: string; acao?: React.ReactNode }[] = [];

  if (redesAtivas.length === 0) {
    pendencias.push({
      chave: 'rede',
      titulo: 'A rede da loja não está liberada',
      como: 'Toda batida é recusada com "Conecte no Wi-Fi da loja" — inclusive pelo QR. Estando na loja agora, libere daqui.',
      acao: equipeAccess.isEquipeAdmin ? (
        <Button
          size="sm"
          className="h-10 bg-blue-600 hover:bg-blue-500"
          disabled={liberandoRede}
          onClick={async () => {
            setAvisoRede(null);
            setLiberandoRede(true);
            const r = await liberarRedeAtual();
            setLiberandoRede(false);
            setAvisoRede(
              r.ok
                ? `Rede ${r.ip} liberada.`
                : (r.mensagem ?? 'Não foi possível liberar esta rede.')
            );
          }}
        >
          {liberandoRede && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
          Liberar a rede onde estou
        </Button>
      ) : undefined,
    });
  }

  // Quem está sem empresa não entra na busca do PIN: o quiosque devolve
  // "PIN não encontrado" e parece defeito, quando é cadastro faltando.
  if (semEmpresa.length > 0) {
    pendencias.push({
      chave: 'sem-empresa',
      titulo:
        semEmpresa.length === 1
          ? `${semEmpresa[0]} não consegue bater ponto`
          : `${semEmpresa.length} pessoas não conseguem bater ponto`,
      como: `Sem empresa vinculada o PIN não é reconhecido no quiosque — a tela diz "PIN não encontrado". Falta preencher para: ${semEmpresa.join(', ')}.`,
    });
  }

  if (estacoesAtivas.length === 0) {
    pendencias.push({
      chave: 'estacao',
      titulo: 'Nenhum computador registrado como estação',
      como: 'Gere um código aqui e digite ele no PC da loja, em /ponto. Não precisa fazer login lá.',
      acao: equipeAccess.isEquipeAdmin ? (
        <Button
          size="sm"
          className="h-10 bg-blue-600 hover:bg-blue-500"
          disabled={preparando}
          onClick={gerarCodigo}
        >
          {preparando && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
          Preparar um computador
        </Button>
      ) : undefined,
    });
  }

  const recusasHoje = tentativas.filter(
    (t) => t.created_at.slice(0, 10) === hojeISO() && t.motivo !== 'sem_ip'
  ).length;

  if (equipeAccess.loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!equipeAccess.isGestorOuAdmin) {
    return (
      <AdminEmptyState
        icon={Clock}
        title="Sem acesso ao ponto da equipe"
        description="Só gestor ou admin acompanha as batidas de todo mundo. As suas ficam em 'Meus registros'."
      />
    );
  }

  if (!empresaAtiva) {
    return (
      <AdminEmptyState
        icon={Clock}
        title="Nenhuma empresa vinculada a você"
        description="Cadastre a empresa em Equipe → Configurações antes de usar o ponto."
      />
    );
  }

  return (
    <div>
      <AdminPageHeader
        icon={Clock}
        title="Ponto"
        description="Quem está na loja agora, as batidas do dia e as estações que registram o ponto."
        action={
          <div className="flex items-center gap-2">
            {/* Abre a tela do balcão numa aba nova: serve pra mostrar a alguém
                sem sair do painel, e sem precisar ir até o PC da loja. */}
            <Button
              variant="outline"
              className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-white"
              onClick={() => window.open('/ponto?demo=1', '_blank', 'noopener')}
            >
              <Monitor className="h-4 w-4 mr-2" />
              Ver ponto
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-500" onClick={() => setLancando(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Lançar batida
            </Button>
          </div>
        }
      />

      {/* Quem saiu do quiosque pelo PIN de manutenção precisa de um caminho de
          volta visível. Sem isso o computador da loja fica preso no painel até
          alguém fechar o navegador. */}
      {esteEhUmQuiosque && (
        <Card className="bg-[#12121a] border-blue-500/30 text-white mb-6">
          <CardContent className="pt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
            <Monitor className="h-4 w-4 text-blue-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white">Este computador é uma estação de ponto</p>
              <p className="text-xs text-blue-300/60 mt-0.5">
                Você saiu do modo fácil com o PIN de manutenção. Voltar deixa a tela pronta pra
                equipe de novo.
              </p>
            </div>
            <Button
              className="h-10 bg-blue-600 hover:bg-blue-500"
              onClick={() => {
                retrancarQuiosque();
                window.location.href = '/ponto';
              }}
            >
              Voltar ao modo quiosque
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Enquanto faltar o básico, o ponto simplesmente não funciona pra
          ninguém — e isso precisa estar na cara de quem abre a tela, não
          escondido numa aba lá embaixo. */}
      {!loadingInfra && pendencias.length > 0 && (
        <Card className="bg-[#f0b429]/10 border-[#f0b429]/40 text-white mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-[#f0b429] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-white">Ninguém consegue bater ponto ainda</p>
                <p className="text-xs text-[#f0b429]/80 mt-0.5">
                  Falta {pendencias.length === 1 ? 'isto' : 'isto'} para o ponto entrar no ar:
                </p>
              </div>
            </div>

            <ul className="space-y-3">
              {pendencias.map((p) => (
                <li key={p.chave} className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-sm text-white min-w-0 flex-1">
                    {p.titulo}
                    <span className="block text-xs text-blue-300/60 mt-0.5">{p.como}</span>
                  </span>
                  {p.acao}
                </li>
              ))}
            </ul>

            {avisoRede && <p className="text-sm text-blue-300 mt-3">{avisoRede}</p>}
            {erroCodigo && <p className="text-sm text-[#ff8a7a] mt-3">{erroCodigo}</p>}
          </CardContent>
        </Card>
      )}

      {/* O código precisa ficar grande: alguém vai lê-lo daqui e digitar num
          teclado do outro lado da loja. */}
      {codigo && (
        <Card className="bg-[#12121a] border-[#2F9E44]/50 text-white mb-6">
          <CardContent className="pt-6">
            <p className="text-sm text-white">Agora, no computador da loja</p>
            <ol className="text-xs text-blue-300/70 mt-2 space-y-1 list-decimal list-inside">
              <li>Abra <span className="font-mono text-blue-300">ubadesklimp.com/ponto</span> nele</li>
              <li>Toque em "Tenho um código" e digite os seis números abaixo</li>
            </ol>

            <p className="font-mono text-5xl sm:text-6xl font-bold tabular-nums tracking-[0.15em] text-[#2F9E44] my-5">
              {codigo}
            </p>

            <p className="text-xs text-blue-300/50">
              Vale por 30 minutos, uma vez só, e só funciona de dentro da rede da loja. Depois disso
              esta tela mostra o computador na lista.
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-10 mt-3 text-blue-300/70 hover:text-white hover:bg-blue-500/10"
              onClick={() => setCodigo(null)}
            >
              Fechar
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <AdminStatCard icon={Users} label="Na loja" value={contagem.naLoja} hint="agora" />
        <AdminStatCard icon={UtensilsCrossed} label="Em almoço ou pausa" value={contagem.almoco} />
        <AdminStatCard icon={CircleDashed} label="Não chegaram" value={contagem.naoChegou} hint="hoje" />
        <AdminStatCard icon={ShieldAlert} label="Batidas recusadas" value={recusasHoje} hint="hoje" />
      </div>

      <Tabs defaultValue="agora">
        <TabsList className="bg-[#12121a] border border-blue-500/20 flex-wrap h-auto">
          <TabsTrigger value="agora">Agora na loja</TabsTrigger>
          <TabsTrigger value="dia">Batidas do dia</TabsTrigger>
          <TabsTrigger value="recusadas">
            Recusadas
            {recusasHoje > 0 && (
              <span className="ml-2 font-mono text-[10px] text-[#f0b429]">{recusasHoje}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="estacoes">Estações e rede</TabsTrigger>
          <TabsTrigger value="qr">
            QR e celulares
            {qrEDispositivos.pendentes.length > 0 && (
              <span className="ml-2 font-mono text-[10px] text-[#f0b429]">
                {qrEDispositivos.pendentes.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ----------------------------------------------------- agora na loja */}
        <TabsContent value="agora">
          <Card className={CARD}>
            <CardContent className="pt-6">
              {loadingAgora ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              ) : pessoas.length === 0 ? (
                <p className="text-sm text-blue-300/60 py-4">Nenhum colaborador nesta empresa.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {pessoas.map((p) => (
                    <div
                      key={p.funcionario_id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-blue-500/10 bg-[#0c0c14] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{p.nome}</p>
                        <p className="text-xs text-blue-300/50 font-mono tabular-nums">
                          {p.desde ? `última batida ${horaDe(p.desde)}` : 'sem batida hoje'}
                        </p>
                      </div>
                      <SeloSituacao situacao={p.situacao} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------ batidas do dia */}
        <TabsContent value="dia">
          <Card className={CARD}>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Input
                  type="date"
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                  className="bg-[#0c0c14] border-blue-500/20 h-11 font-mono w-[10rem] text-white [color-scheme:dark]"
                />
                {dia !== hojeISO() && (
                  <Button
                    variant="ghost"
                    className="h-11 text-blue-300/70 hover:text-white hover:bg-blue-500/10"
                    onClick={() => setDia(hojeISO())}
                  >
                    Voltar pra hoje
                  </Button>
                )}
              </div>

              {loadingDia ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              ) : marcacoes.length === 0 ? (
                <p className="text-sm text-blue-300/60 py-4">Nenhuma batida neste dia.</p>
              ) : (
                <div className="divide-y divide-blue-500/10">
                  {marcacoes.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                      <span className="font-mono text-base text-white tabular-nums w-14">{m.hora}</span>
                      <span className="text-sm text-white min-w-0 flex-1 truncate">{m.nome}</span>
                      <span className="text-xs text-blue-300/70">{TIPO_LABEL[m.tipo]}</span>
                      {m.origem === 'lancamento_gestor' && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-[#f0b429]/20 text-[#f0b429]"
                          title={m.motivo_lancamento ?? undefined}
                        >
                          lançada por {m.marcado_por ?? 'gestor'}
                        </span>
                      )}
                      {m.origem === 'abertura_coletiva' && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-[#f0b429]/20 text-[#f0b429]">
                          abertura · {m.marcado_por ?? 'responsável'}
                        </span>
                      )}
                      {m.confirmacao === 'pendente' && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-[#6B7280] text-white">
                          aguarda confirmação
                        </span>
                      )}
                      {m.confirmacao === 'contestada' && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-[#C0392B] text-white">
                          contestada
                        </span>
                      )}
                      <span className="font-mono text-[11px] text-blue-300/40 tabular-nums">
                        {m.codigo}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------------- recusadas */}
        <TabsContent value="recusadas">
          <Card className={CARD}>
            <CardContent className="pt-6">
              <p className="text-xs text-blue-300/50 mb-4">
                Toda tentativa que o banco recusou fica registrada. Serve pra saber se alguém está
                tentando bater de fora da loja — ou se a rede mudou e o ponto parou de aceitar.
              </p>
              {loadingInfra ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              ) : tentativas.length === 0 ? (
                <p className="text-sm text-blue-300/60 py-4">Nenhuma tentativa recusada.</p>
              ) : (
                <div className="divide-y divide-blue-500/10">
                  {tentativas.map((t) => (
                    <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                      <span className="font-mono text-xs text-blue-300/60 tabular-nums w-24">
                        {quandoDe(t.created_at)}
                      </span>
                      <span className="text-sm text-white min-w-0 flex-1 truncate">
                        {t.nome ?? 'desconhecido'}
                      </span>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-[#C0392B]/20 text-[#ff8a7a]">
                        {MOTIVO_LABEL[t.motivo]}
                      </span>
                      <span className="font-mono text-[11px] text-blue-300/40">
                        {t.detalhe ?? t.ip ?? ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------- estações e rede */}
        <TabsContent value="estacoes" className="space-y-4">
          <Card className={CARD}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Monitor className="h-4 w-4 text-blue-400" />
                <p className="text-sm text-white">Computadores que batem ponto</p>
              </div>
              <p className="text-xs text-blue-300/50 mb-4">
                Gere um código aqui e digite ele em <span className="font-mono">/ponto</span> no
                computador da loja — não precisa fazer login lá. Revogar derruba aquele computador
                na hora.
              </p>

              {equipeAccess.isEquipeAdmin && (
                <div className="flex flex-wrap items-end gap-3 mb-4">
                  <Input
                    value={nomeNovaEstacao}
                    onChange={(e) => setNomeNovaEstacao(e.target.value)}
                    placeholder="Nome do computador"
                    className="bg-[#0c0c14] border-blue-500/20 h-11 w-48 text-white placeholder:text-blue-300/40"
                  />
                  <Button
                    className="h-11 bg-blue-600 hover:bg-blue-500"
                    disabled={preparando}
                    onClick={gerarCodigo}
                  >
                    {preparando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Preparar um computador
                  </Button>
                </div>
              )}

              {loadingInfra ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              ) : estacoes.length === 0 ? (
                <p className="text-sm text-blue-300/60 py-2">
                  Nenhuma estação registrada ainda.
                </p>
              ) : (
                <div className="divide-y divide-blue-500/10">
                  {estacoes.map((e) => (
                    <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                      <span className="text-sm text-white min-w-0 flex-1 truncate">
                        {e.nome}
                        {e.local && <span className="text-blue-300/50"> · {e.local}</span>}
                      </span>
                      <span className="font-mono text-[11px] text-blue-300/50 tabular-nums">
                        {e.ultimo_ip ?? 'sem IP'} · visto {horaDe(e.ultimo_heartbeat)}
                      </span>
                      {e.revogada_em ? (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-[#6B7280] text-white">
                          revogada
                        </span>
                      ) : (
                        equipeAccess.isEquipeAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 border-[#C0392B]/40 text-[#ff8a7a] hover:bg-[#C0392B]/10 hover:text-white"
                            onClick={() => revogarEstacao(e.id)}
                          >
                            Revogar
                          </Button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {equipeAccess.isEquipeAdmin && (
            <Card className={CARD}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="h-4 w-4 text-blue-400" />
                  <p className="text-sm text-white">PIN de manutenção do quiosque</p>
                </div>
                <p className="text-xs text-blue-300/50 mb-4">
                  É ele que sai do modo quiosque no PC da loja e devolve o painel naquele
                  computador. Enquanto não houver PIN, o PC registrado continua abrindo o admin
                  normalmente — ninguém fica trancado sem ter como voltar.
                </p>

                <div className="flex flex-wrap items-end gap-3">
                  <Input
                    value={novoPin}
                    onChange={(e) => setNovoPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    inputMode="numeric"
                    placeholder="4 a 8 dígitos"
                    className="bg-[#0c0c14] border-blue-500/20 h-11 font-mono w-40 text-white placeholder:text-blue-300/40"
                  />
                  <Button
                    className="h-11 bg-blue-600 hover:bg-blue-500"
                    disabled={novoPin.length < 4 || salvandoPin}
                    onClick={async () => {
                      setErroPin(null);
                      setSalvandoPin(true);
                      const r = await pinManutencao.definir(novoPin);
                      setSalvandoPin(false);
                      if (r.ok) setNovoPin('');
                      else setErroPin(r.mensagem ?? 'Não foi possível salvar.');
                    }}
                  >
                    {salvandoPin && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {pinManutencao.definido ? 'Trocar PIN' : 'Definir PIN'}
                  </Button>
                  <span className="text-xs text-blue-300/50">
                    {pinManutencao.definido === null
                      ? ''
                      : pinManutencao.definido
                        ? 'PIN definido — o quiosque tranca o resto do admin.'
                        : 'Nenhum PIN ainda.'}
                  </span>
                </div>
                {erroPin && <p className="text-sm text-[#ff8a7a] mt-2">{erroPin}</p>}
              </CardContent>
            </Card>
          )}

          <Card className={CARD}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Wifi className="h-4 w-4 text-blue-400" />
                <p className="text-sm text-white">IPs aceitos como rede da loja</p>
              </div>
              <p className="text-xs text-blue-300/50 mb-4">
                A estação atualiza sozinha o IP a cada 5 minutos. Se o provedor trocar o IP e
                ninguém conseguir bater, libere a rede daqui — estando na loja — e desative a
                antiga.
              </p>

              {equipeAccess.isEquipeAdmin && (
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-white"
                    disabled={liberandoRede}
                    onClick={async () => {
                      setAvisoRede(null);
                      setLiberandoRede(true);
                      const r = await liberarRedeAtual();
                      setLiberandoRede(false);
                      setAvisoRede(
                        r.ok
                          ? `Rede ${r.ip} liberada.`
                          : (r.mensagem ?? 'Não foi possível liberar esta rede.')
                      );
                    }}
                  >
                    {liberandoRede && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
                    Liberar a rede onde estou
                  </Button>
                  {avisoRede && <span className="text-xs text-blue-300/70">{avisoRede}</span>}
                </div>
              )}

              {loadingInfra ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              ) : redes.length === 0 ? (
                <p className="text-sm text-blue-300/60 py-2">
                  Nenhum IP liberado. Abra <span className="font-mono">/ponto</span> na loja pra
                  cadastrar o primeiro.
                </p>
              ) : (
                <div className="divide-y divide-blue-500/10">
                  {redes.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                      <span className="font-mono text-sm text-white min-w-0 flex-1">{r.ip}</span>
                      <span className="text-[11px] text-blue-300/50">
                        {r.origem === 'heartbeat' ? 'detectado' : 'manual'} · visto{' '}
                        {quandoDe(r.visto_em)}
                      </span>
                      {equipeAccess.isEquipeAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-white"
                          onClick={() => alternarRede(r.id, !r.ativo)}
                        >
                          {r.ativo ? 'Desativar' : 'Reativar'}
                        </Button>
                      )}
                      {!r.ativo && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-[#6B7280] text-white">
                          inativo
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qr" className="space-y-4">
          {equipeAccess.isEquipeAdmin && (
            <Card className={CARD}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Coffee className="h-4 w-4 text-blue-400" />
                  <p className="text-sm text-white">Pausas de café</p>
                </div>
                <p className="text-xs text-blue-300/50 mb-4">
                  Divide o intervalo de 2h em almoço de 1h30 mais café. Antes de ligar, formalize
                  por escrito: pausa de café não prevista em lei pode ser cobrada como hora extra
                  (Súmula 118 do TST). Com isso desligado, ninguém bate pausa e os modelos com café
                  não podem ser escolhidos.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    className={
                      pausasCafe.ativo
                        ? 'h-11 bg-[#C0392B] hover:bg-[#a63224]'
                        : 'h-11 bg-blue-600 hover:bg-blue-500'
                    }
                    disabled={pausasCafe.ativo === null || pausasCafe.salvando}
                    onClick={() => pausasCafe.definir(!pausasCafe.ativo)}
                  >
                    {pausasCafe.salvando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {pausasCafe.ativo ? 'Desligar pausas de café' : 'Ligar pausas de café'}
                  </Button>
                  <span className="text-xs text-blue-300/50">
                    {pausasCafe.ativo === null
                      ? ''
                      : pausasCafe.ativo
                        ? 'Ligadas nesta empresa.'
                        : 'Desligadas — todo mundo no almoço de 2h.'}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <PontoQrLocais
            locais={qrEDispositivos.locais}
            dispositivos={qrEDispositivos.dispositivos}
            loading={qrEDispositivos.loading}
            podeGerenciar={equipeAccess.isEquipeAdmin}
            criarLocalQr={qrEDispositivos.criarLocalQr}
            rotacionarQr={qrEDispositivos.rotacionarQr}
            decidirDispositivo={qrEDispositivos.decidirDispositivo}
          />
        </TabsContent>
      </Tabs>

      <LancarMarcacaoDialog
        aberto={lancando}
        pessoas={pessoasDaEmpresa}
        onFechar={() => setLancando(false)}
        onLancar={lancarMarcacao}
      />
    </div>
  );
};

export default PontoManager;

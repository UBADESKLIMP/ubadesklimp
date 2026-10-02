import { useMemo, useState } from 'react';
import {
  Clock,
  Loader2,
  Monitor,
  Wifi,
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
import {
  usePontoAgora,
  usePontoDoDia,
  usePontoInfra,
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
  const { marcacoes, loading: loadingDia } = usePontoDoDia(empresaAtiva, dia);
  const { estacoes, redes, tentativas, loading: loadingInfra, revogarEstacao, alternarRede } =
    usePontoInfra(empresaAtiva);
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
      />

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
                Registre o PC abrindo <span className="font-mono">/ponto</span> nele, logado como
                admin. Revogar derruba aquele computador na hora.
              </p>

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
                ninguém conseguir bater, desative o antigo aqui.
              </p>

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
      </Tabs>
    </div>
  );
};

export default PontoManager;

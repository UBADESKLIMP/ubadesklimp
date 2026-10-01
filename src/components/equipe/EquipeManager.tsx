import { useMemo, useState } from 'react';
import { Users, Clock, DoorOpen, AlertTriangle, Plus, Loader2 } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminStatCard from '@/components/admin/AdminStatCard';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEquipeAccess } from '@/hooks/useEquipeAccess';
import {
  useAberturaDoDia,
  useEquipeAtrasos,
  useEquipeColaboradores,
  useEquipeEmpresas,
} from '@/hooks/useEquipe';
import { EquipeStatusBadge, MinutosAtraso } from './EquipeStatusBadge';
import LancarAtrasoDialog from './LancarAtrasoDialog';
import FichaColaboradorDialog from './FichaColaboradorDialog';
import EquipeRelatorio from './EquipeRelatorio';
import EquipeConfig from './EquipeConfig';

const hojeISO = () => new Date().toISOString().slice(0, 10);

const formatarData = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const EquipeManager = () => {
  const equipeAccess = useEquipeAccess();
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [colaboradorInicial, setColaboradorInicial] = useState<string | null>(null);
  const [fichaDe, setFichaDe] = useState<string | null>(null);
  const [horaAberturaInput, setHoraAberturaInput] = useState('');

  const empresaAtiva = empresaSelecionada ?? equipeAccess.empresaIds[0] ?? null;
  const empresaIds = useMemo(
    () => (empresaAtiva ? [empresaAtiva] : []),
    [empresaAtiva]
  );

  const empresas = useEquipeEmpresas(equipeAccess.empresaIds);
  const { colaboradores, loading: loadingColaboradores } = useEquipeColaboradores(empresaIds);
  const { atrasos, loading: loadingAtrasos, pedirPrevia, lancarAtraso } = useEquipeAtrasos(empresaIds);
  const { horaAbertura, registrarAbertura, salvando } = useAberturaDoDia(empresaAtiva);

  const hoje = hojeISO();
  const atrasosHoje = atrasos.filter((a) => a.data === hoje);
  const semCiencia = atrasos.filter((a) => a.status === 'pendente_ciencia');
  const justificando = atrasos.filter((a) => a.status === 'justificativa_pendente');
  const foraDaTolerancia = atrasosHoje.filter((a) => a.dentro_tolerancia === false);

  const nomePorId = useMemo(
    () => new Map(colaboradores.map((c) => [c.user_id, c.display_name])),
    [colaboradores]
  );

  // A abertura só é "atrasada" se for depois da entrada da escala. Sem escala
  // carregada aqui, trata qualquer abertura registrada como possivelmente
  // atrasada — o banco é quem decide de fato no cálculo.
  const aberturaAtrasada = Boolean(horaAbertura);

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
        icon={Users}
        title="Sem acesso ao módulo Equipe"
        description="Só gestor ou admin pode lançar atrasos e aplicar medidas. Seus próprios registros ficam em 'Meus registros'."
      />
    );
  }

  // Sem empresa não há o que mostrar nas outras abas — mas o admin precisa
  // conseguir chegar nas configurações justamente pra cadastrar a primeira.
  if (equipeAccess.empresaIds.length === 0) {
    return (
      <div>
        <AdminPageHeader
          icon={Users}
          title="Equipe"
          description="Comece cadastrando a empresa e a escala."
        />
        {equipeAccess.isEquipeAdmin ? (
          <EquipeConfig />
        ) : (
          <AdminEmptyState
            icon={Users}
            title="Nenhuma empresa vinculada a você"
            description="Peça pro admin cadastrar a empresa e vincular seu acesso de gestor a ela."
          />
        )}
      </div>
    );
  }

  const renderLinhaAtraso = (atraso: typeof atrasos[number]) => (
    <div
      key={atraso.id}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-blue-500/10 py-3 last:border-0"
    >
      <button
        type="button"
        onClick={() => setFichaDe(atraso.colaborador_id)}
        className="text-sm font-medium text-white hover:text-blue-300 text-left min-w-[8rem]"
      >
        {nomePorId.get(atraso.colaborador_id) ?? 'Colaborador'}
      </button>

      <span className="font-mono text-xs text-blue-300/60 tabular-nums">
        {formatarData(atraso.data)} · {atraso.marcacao === 'entrada' ? 'entrada' : 'almoço'}{' '}
        {atraso.hora_chegada.slice(0, 5)}
      </span>

      <MinutosAtraso minutos={atraso.minutos_atraso} dentroTolerancia={atraso.dentro_tolerancia} />

      <EquipeStatusBadge status={atraso.status} className="ml-auto" />
    </div>
  );

  return (
    <div>
      <AdminPageHeader
        icon={Users}
        title="Equipe"
        description="Atrasos, ciências e medidas disciplinares."
        action={
          <Button
            onClick={() => {
              setColaboradorInicial(null);
              setDialogAberto(true);
            }}
            className="bg-blue-600 hover:bg-blue-500 h-11"
          >
            <Plus className="h-4 w-4 mr-2" />
            Lançar atraso
          </Button>
        }
      />

      {equipeAccess.empresaIds.length > 1 && (
        <div className="mb-6 max-w-xs">
          <Label className="text-blue-300/70 text-xs">Empresa</Label>
          <Select value={empresaAtiva ?? ''} onValueChange={setEmpresaSelecionada}>
            <SelectTrigger className="bg-[#12121a] border-blue-500/20 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#12121a] border-blue-500/20 text-white">
              {equipeAccess.empresaIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {empresas.find((e) => e.id === id)?.razao_social ?? 'Carregando...'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <AdminStatCard icon={Clock} label="Atrasos hoje" value={atrasosHoje.length} />
        <AdminStatCard
          icon={AlertTriangle}
          label="Fora da tolerância"
          value={foraDaTolerancia.length}
          hint="hoje"
        />
        <AdminStatCard icon={Users} label="Aguardando ciência" value={semCiencia.length} />
        <AdminStatCard icon={DoorOpen} label="Justificativas" value={justificando.length} hint="para decidir" />
      </div>

      <Card className="bg-[#12121a] border-blue-500/20 mb-6">
        <CardContent className="pt-6">
          {horaAbertura ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white">
                  Hoje a loja abriu às{' '}
                  <span className="font-mono font-semibold text-[#f0b429]">
                    {horaAbertura.slice(0, 5)}
                  </span>
                </p>
                <p className="text-xs text-blue-300/50 mt-1">
                  Quem estava na porta na hora da abertura tem a referência ajustada.
                </p>
              </div>
              <span className="text-xs text-blue-300/40">registrado</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-white">A loja abriu no horário hoje?</p>
                <p className="text-xs text-blue-300/50 mt-1">
                  Só registre a abertura se ela atrasou — isso muda o cálculo de quem já estava na porta.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-blue-300/70 text-xs">Abrimos às</Label>
                  <Input
                    type="time"
                    inputMode="numeric"
                    value={horaAberturaInput}
                    onChange={(e) => setHoraAberturaInput(e.target.value)}
                    className="bg-[#0c0c14] border-blue-500/20 h-11 font-mono w-[7.5rem]"
                  />
                </div>
                <Button
                  onClick={() => registrarAbertura(horaAberturaInput)}
                  disabled={!/^\d{2}:\d{2}$/.test(horaAberturaInput) || salvando}
                  className="h-11 bg-blue-600 hover:bg-blue-500"
                >
                  {salvando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Registrar abertura atrasada
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="hoje">
        <TabsList className="bg-[#12121a] border border-blue-500/20">
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="pendencias">
            Pendências
            {semCiencia.length + justificando.length > 0 && (
              <span className="ml-2 font-mono text-[10px] text-[#f0b429]">
                {semCiencia.length + justificando.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="equipe">Colaboradores</TabsTrigger>
          <TabsTrigger value="relatorio">Relatório</TabsTrigger>
          {equipeAccess.isEquipeAdmin && <TabsTrigger value="config">Configurações</TabsTrigger>}
        </TabsList>

        <TabsContent value="hoje">
          <Card className="bg-[#12121a] border-blue-500/20">
            <CardContent className="pt-6">
              {loadingAtrasos ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              ) : atrasosHoje.length === 0 ? (
                <p className="text-sm text-blue-300/60 py-4">
                  Nenhum atraso lançado hoje. Bom sinal.
                </p>
              ) : (
                atrasosHoje.map(renderLinhaAtraso)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pendencias">
          <Card className="bg-[#12121a] border-blue-500/20">
            <CardContent className="pt-6">
              {[...justificando, ...semCiencia].length === 0 ? (
                <p className="text-sm text-blue-300/60 py-4">Nada pendente.</p>
              ) : (
                [...justificando, ...semCiencia].map(renderLinhaAtraso)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipe">
          <Card className="bg-[#12121a] border-blue-500/20">
            <CardContent className="pt-6">
              {loadingColaboradores ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              ) : colaboradores.length === 0 ? (
                <p className="text-sm text-blue-300/60 py-4">
                  Nenhum colaborador vinculado a esta empresa ainda. Vincule empresa e escala na tela
                  de Funcionários.
                </p>
              ) : (
                colaboradores.map((c) => (
                  <div
                    key={c.user_id}
                    className="flex flex-wrap items-center gap-3 border-b border-blue-500/10 py-3 last:border-0"
                  >
                    <button
                      type="button"
                      onClick={() => setFichaDe(c.user_id)}
                      className="text-sm font-medium text-white hover:text-blue-300 text-left"
                    >
                      {c.display_name}
                    </button>

                    {!c.escala_id && (
                      <span className="text-[10px] uppercase tracking-wider text-[#C0392B] border-2 border-[#C0392B]/70 bg-[#C0392B]/10 rounded-[3px] px-2 py-0.5 -rotate-[1.5deg]">
                        sem escala
                      </span>
                    )}
                    {!c.termo_assinado_em && (
                      <span className="text-[10px] uppercase tracking-wider text-[#6B7280] border-2 border-[#6B7280]/70 bg-[#6B7280]/10 rounded-[3px] px-2 py-0.5 -rotate-[1.5deg]">
                        sem termo
                      </span>
                    )}

                    <span className="font-mono text-xs text-blue-300/50 tabular-nums">
                      almoço {c.almoco_previsto?.slice(0, 5) ?? '--:--'} · {c.duracao_almoco_min} min
                    </span>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setColaboradorInicial(c.user_id);
                        setDialogAberto(true);
                      }}
                      disabled={!c.escala_id}
                      className="ml-auto text-blue-300/70 hover:text-white hover:bg-blue-500/10"
                    >
                      Lançar atraso
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="relatorio">
          <EquipeRelatorio empresaId={empresaAtiva} />
        </TabsContent>

        {equipeAccess.isEquipeAdmin && (
          <TabsContent value="config">
            <EquipeConfig />
          </TabsContent>
        )}
      </Tabs>

      <LancarAtrasoDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        colaboradores={colaboradores.filter((c) => c.escala_id)}
        empresaId={empresaAtiva}
        data={hoje}
        aberturaAtrasada={aberturaAtrasada}
        colaboradorInicial={colaboradorInicial}
        pedirPrevia={pedirPrevia}
        onLancar={lancarAtraso}
      />

      <FichaColaboradorDialog
        colaboradorId={fichaDe}
        onOpenChange={(open) => !open && setFichaDe(null)}
        nome={fichaDe ? nomePorId.get(fichaDe) ?? 'Colaborador' : ''}
        atrasos={fichaDe ? atrasos.filter((a) => a.colaborador_id === fichaDe) : []}
        isEquipeAdmin={equipeAccess.isEquipeAdmin}
      />
    </div>
  );
};

export default EquipeManager;

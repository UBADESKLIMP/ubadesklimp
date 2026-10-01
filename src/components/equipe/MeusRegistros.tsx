import { useEffect, useState } from 'react';
import { ClipboardCheck, Loader2, FileSignature, FileDown } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMeusRegistros } from '@/hooks/useEquipe';
import { EquipeStatusBadge, EquipeMedidaBadge, MinutosAtraso } from './EquipeStatusBadge';
import { downloadAdvertenciaPdf, type DadosAdvertencia } from '@/lib/equipeAdvertencia';
import JustificarPontoDialog from './JustificarPontoDialog';
import { STATUS_LABEL, TIPO_LABEL, useJustificativasPonto } from '@/hooks/useJustificativaPonto';
import { useEquipeAccess } from '@/hooks/useEquipeAccess';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type MedidaTipo = Database['public']['Enums']['equipe_medida_tipo'];

const formatarData = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

const TEXTO_CIENCIA =
  'Declaro que fui informado(a) deste registro e tive a oportunidade de apresentar justificativa.';

const MeusRegistros = () => {
  const { toast } = useToast();
  const { atrasos, loading, darCiencia, justificar } = useMeusRegistros();
  const [justificandoId, setJustificandoId] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [justificandoPonto, setJustificandoPonto] = useState(false);
  const equipeAccess = useEquipeAccess();
  const { user } = useAuth();
  const {
    justificativas,
    criar: criarJustificativaPonto,
    darCiencia: darCienciaJustificativa,
  } = useJustificativasPonto([], true);
  const [medidas, setMedidas] = useState<
    { id: string; tipo: MedidaTipo; data_aplicacao: string; fundamento: string; status: string }[]
  >([]);

  const carregarMedidas = () =>
    supabase
      .from('equipe_medidas')
      .select('id, tipo, data_aplicacao, fundamento, status')
      .order('data_aplicacao', { ascending: false })
      .then(({ data }) => setMedidas(data ?? []));

  useEffect(() => {
    carregarMedidas();
  }, []);

  const baixarPdf = async (medidaId: string) => {
    setBaixando(medidaId);
    const { data, error } = await supabase.rpc('equipe_dados_advertencia', { p_medida_id: medidaId });
    setBaixando(null);
    if (error || !data) {
      toast({ title: 'Não foi possível baixar', description: error?.message, variant: 'destructive' });
      return;
    }
    downloadAdvertenciaPdf(data as unknown as DadosAdvertencia);
  };

  const darCienciaMedida = async (medidaId: string) => {
    const { error } = await supabase.rpc('equipe_registrar_ciencia', {
      p_alvo_tipo: 'medida',
      p_alvo_id: medidaId,
      p_acao: 'ciente',
    });
    if (error) {
      toast({ title: 'Não foi possível registrar a ciência', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Ciência registrada' });
    await carregarMedidas();
  };

  const pendentes = atrasos.filter((a) => a.status === 'pendente_ciencia');
  const historico = atrasos.filter((a) => a.status !== 'pendente_ciencia');

  const enviarJustificativa = async () => {
    if (!justificandoId || texto.trim().length < 10) return;
    setEnviando(true);
    const ok = await justificar(justificandoId, texto.trim());
    setEnviando(false);
    if (ok) {
      setJustificandoId(null);
      setTexto('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        icon={ClipboardCheck}
        title="Meus registros"
        description="Seus atrasos, ciências e medidas. Só você e a gestão veem isso."
      />

      <Tabs defaultValue="pendentes">
        <TabsList className="bg-[#12121a] border border-blue-500/20">
          <TabsTrigger value="pendentes">
            Pendentes
            {pendentes.length > 0 && (
              <span className="ml-2 font-mono text-[10px] text-[#f0b429]">{pendentes.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="ponto">Ajustes de ponto</TabsTrigger>
          <TabsTrigger value="medidas">Minhas medidas</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          {pendentes.length === 0 ? (
            <AdminEmptyState
              icon={ClipboardCheck}
              title="Nada aguardando você"
              description="Quando um registro novo aparecer, ele fica aqui para você dar ciência ou justificar."
            />
          ) : (
            <div className="space-y-4">
              {pendentes.map((a) => (
                <Card key={a.id} className="bg-[#12121a] border-blue-500/20">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-sm text-white tabular-nums">
                        {formatarData(a.data)}
                      </span>
                      <span className="text-sm text-blue-300/70">
                        {a.marcacao === 'entrada' ? 'Entrada' : 'Retorno do almoço'} às{' '}
                        <span className="font-mono">{a.hora_chegada.slice(0, 5)}</span>
                      </span>
                      <MinutosAtraso minutos={a.minutos_atraso} dentroTolerancia={a.dentro_tolerancia} />
                      <EquipeStatusBadge status={a.status} className="ml-auto" />
                    </div>

                    <p className="font-mono text-xs text-blue-300/50">
                      horário de referência {a.horario_referencia?.slice(0, 5)}
                      {a.desvio_saida_almoco_min != null && a.desvio_saida_almoco_min !== 0 && (
                        <>
                          {' '}
                          · saída do almoço {a.desvio_saida_almoco_min > 0 ? '+' : ''}
                          {a.desvio_saida_almoco_min} min do previsto
                        </>
                      )}
                    </p>

                    <p className="text-xs text-blue-300/60 border-l-2 border-blue-500/30 pl-3">
                      {TEXTO_CIENCIA}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => darCiencia(a.id)}
                        className="bg-blue-600 hover:bg-blue-500 h-11 flex-1 min-w-[10rem]"
                      >
                        <FileSignature className="h-4 w-4 mr-2" />
                        Estou ciente
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setJustificandoId(a.id);
                          setTexto('');
                        }}
                        className="h-11 flex-1 min-w-[10rem] border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-white"
                      >
                        Quero justificar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico">
          <Card className="bg-[#12121a] border-blue-500/20">
            <CardContent className="pt-6">
              {historico.length === 0 ? (
                <p className="text-sm text-blue-300/60 py-4">Nenhum registro no histórico.</p>
              ) : (
                historico.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 border-b border-blue-500/10 py-3 last:border-0"
                  >
                    <span className="font-mono text-xs text-blue-300/60 tabular-nums">
                      {formatarData(a.data)}
                    </span>
                    <span className="text-xs text-blue-300/50">
                      {a.marcacao === 'entrada' ? 'entrada' : 'almoço'} {a.hora_chegada.slice(0, 5)}
                    </span>
                    <MinutosAtraso minutos={a.minutos_atraso} dentroTolerancia={a.dentro_tolerancia} />
                    <EquipeStatusBadge status={a.status} className="ml-auto" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ponto">
          <Card className="bg-[#12121a] border-blue-500/20">
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-blue-300/60">
                  Esqueceu de bater, bateu errado ou saiu a serviço? Registre aqui em vez do
                  caderno.
                </p>
                <Button
                  onClick={() => setJustificandoPonto(true)}
                  className="bg-blue-600 hover:bg-blue-500 h-11"
                >
                  Justificar ponto
                </Button>
              </div>

              {justificativas.length === 0 ? (
                <p className="text-sm text-blue-300/60 py-2">Nenhuma solicitação enviada.</p>
              ) : (
                <div className="divide-y divide-blue-500/10">
                  {justificativas.map((j) => (
                    <div key={j.id} className="py-3 space-y-2 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-xs text-blue-300/60 tabular-nums">
                          {formatarData(j.data)}
                        </span>
                        <span className="text-xs text-blue-300/70">{TIPO_LABEL[j.tipo]}</span>
                        {j.intervalo_calculado_min != null && (
                          <span className="font-mono text-xs text-blue-300/50">
                            intervalo {j.intervalo_calculado_min} min
                          </span>
                        )}
                        <span className="ml-auto text-[10px] uppercase tracking-wider text-blue-300/60 border-2 border-blue-500/30 bg-blue-500/10 rounded-[3px] px-2 py-0.5 -rotate-[1.5deg]">
                          {STATUS_LABEL[j.status]}
                        </span>
                      </div>

                      {j.motivo_rejeicao && (
                        <p className="text-xs text-[#C0392B] border-l-2 border-[#C0392B]/40 pl-3">
                          Rejeitada: {j.motivo_rejeicao}
                        </p>
                      )}

                      {j.status === 'aguardando_ciencia' && (
                        <Button
                          size="sm"
                          onClick={() => darCienciaJustificativa(j.id)}
                          className="h-10 bg-blue-600 hover:bg-blue-500"
                        >
                          <FileSignature className="h-3.5 w-3.5 mr-2" />
                          Confirmo que os horários estão certos
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medidas">
          <Card className="bg-[#12121a] border-blue-500/20">
            <CardContent className="pt-6">
              {medidas.length === 0 ? (
                <p className="text-sm text-blue-300/60 py-4">Nenhuma medida registrada.</p>
              ) : (
                medidas.map((m) => (
                  <div key={m.id} className="border-b border-blue-500/10 py-3 last:border-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-xs text-blue-300/60 tabular-nums">
                        {formatarData(m.data_aplicacao)}
                      </span>
                      <EquipeMedidaBadge tipo={m.tipo} />
                      <span className="text-xs text-blue-300/60 flex-1 min-w-[10rem]">{m.fundamento}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {m.tipo !== 'orientacao_verbal' && m.tipo !== 'orientacao_verbal_coletiva' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => baixarPdf(m.id)}
                          disabled={baixando === m.id}
                          className="h-9 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-white"
                        >
                          {baixando === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                          ) : (
                            <FileDown className="h-3.5 w-3.5 mr-2" />
                          )}
                          Baixar PDF
                        </Button>
                      )}

                      {m.tipo === 'orientacao_verbal' && m.status !== 'aplicada' && (
                        <Button
                          size="sm"
                          onClick={() => darCienciaMedida(m.id)}
                          className="h-9 bg-blue-600 hover:bg-blue-500"
                        >
                          <FileSignature className="h-3.5 w-3.5 mr-2" />
                          Estou ciente
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <JustificarPontoDialog
        open={justificandoPonto}
        onOpenChange={setJustificandoPonto}
        colaboradorId={user?.id ?? ''}
        isGestor={equipeAccess.isGestorOuAdmin}
        atrasos={atrasos}
        onCriar={criarJustificativaPonto}
      />

      <Dialog open={Boolean(justificandoId)} onOpenChange={(open) => !open && setJustificandoId(null)}>
        <DialogContent className="bg-[#12121a] border-blue-500/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Justificar atraso</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-blue-300/70">O que aconteceu?</Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={5}
              placeholder="Explique o motivo. O gestor vai avaliar e decidir se abona."
              className="bg-[#0c0c14] border-blue-500/20"
            />
            <p className="text-xs text-blue-300/50">Mínimo de 10 caracteres.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setJustificandoId(null)}
              className="text-blue-300/70 hover:text-white hover:bg-blue-500/10"
            >
              Cancelar
            </Button>
            <Button
              onClick={enviarJustificativa}
              disabled={texto.trim().length < 10 || enviando}
              className="bg-blue-600 hover:bg-blue-500"
            >
              {enviando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enviar justificativa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeusRegistros;

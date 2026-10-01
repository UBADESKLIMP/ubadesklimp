import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShieldAlert, FileDown, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useEscalonamento, type EquipeAtraso } from '@/hooks/useEquipe';
import { EquipeStatusBadge, EquipeMedidaBadge, MinutosAtraso, MEDIDA_LABEL } from './EquipeStatusBadge';
import { downloadAdvertenciaPdf, type DadosAdvertencia } from '@/lib/equipeAdvertencia';
import type { Database } from '@/integrations/supabase/types';

type MedidaTipo = Database['public']['Enums']['equipe_medida_tipo'];

interface Props {
  colaboradorId: string | null;
  nome: string;
  atrasos: EquipeAtraso[];
  isEquipeAdmin: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatarData = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

const FichaColaboradorDialog = ({ colaboradorId, nome, atrasos, isEquipeAdmin, onOpenChange }: Props) => {
  const { toast } = useToast();
  const { contagem, sugestao, reload: reloadEscalonamento } = useEscalonamento(colaboradorId);
  const [medidasAplicadas, setMedidasAplicadas] = useState<
    { id: string; tipo: MedidaTipo; data_aplicacao: string; fundamento: string; status: string }[]
  >([]);
  const [aplicando, setAplicando] = useState(false);
  const [gerandoPdfDe, setGerandoPdfDe] = useState<string | null>(null);
  const [subindoDe, setSubindoDe] = useState<string | null>(null);
  const [modoMedida, setModoMedida] = useState<MedidaTipo | null>(null);
  const [fundamento, setFundamento] = useState('');
  const [diasSuspensao, setDiasSuspensao] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const aberto = Boolean(colaboradorId);

  // Só atraso livre (fora da tolerância, não abonado, sem medida vinculada)
  // pode fundamentar uma medida nova — non bis in idem (PRD R6).
  const atrasosLivres = useMemo(
    () =>
      atrasos.filter(
        (a) => a.dentro_tolerancia === false && !['abonado', 'substituido'].includes(a.status)
      ),
    [atrasos]
  );

  useEffect(() => {
    if (!colaboradorId) return;
    setModoMedida(null);
    setFundamento('');
    setDiasSuspensao('');
    setSelecionados(new Set());

    supabase
      .from('equipe_medidas')
      .select('id, tipo, data_aplicacao, fundamento, status')
      .eq('colaborador_id', colaboradorId)
      .order('data_aplicacao', { ascending: false })
      .then(({ data }) => setMedidasAplicadas(data ?? []));
  }, [colaboradorId]);

  useEffect(() => {
    if (sugestao) setModoMedida(sugestao);
  }, [sugestao]);

  const aplicarMedida = async () => {
    if (!colaboradorId || !modoMedida || !fundamento.trim()) return;
    if (modoMedida === 'suspensao' && !/^\d+$/.test(diasSuspensao)) {
      toast({ title: 'Informe os dias de suspensão', variant: 'destructive' });
      return;
    }

    setAplicando(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data: medida, error } = await supabase
      .from('equipe_medidas')
      .insert({
        colaborador_id: colaboradorId,
        tipo: modoMedida,
        dias_suspensao: modoMedida === 'suspensao' ? Number(diasSuspensao) : null,
        fundamento: fundamento.trim(),
        criado_por: auth.user?.id as string,
        status: modoMedida === 'advertencia_escrita' ? 'aguardando_assinatura' : 'rascunho',
      })
      .select('id')
      .single();

    if (error || !medida) {
      setAplicando(false);
      toast({
        title: 'Não foi possível aplicar a medida',
        description: error?.message,
        variant: 'destructive',
      });
      return;
    }

    if (selecionados.size > 0) {
      const { error: vinculoError } = await supabase.from('equipe_medida_atrasos').insert(
        [...selecionados].map((atrasoId) => ({ medida_id: medida.id, atraso_id: atrasoId }))
      );
      if (vinculoError) {
        setAplicando(false);
        toast({
          title: 'Medida criada, mas os atrasos não foram vinculados',
          description: vinculoError.message,
          variant: 'destructive',
        });
        return;
      }
    }

    setAplicando(false);
    toast({ title: `${MEDIDA_LABEL[modoMedida]} registrada` });
    setFundamento('');
    setSelecionados(new Set());
    await reloadEscalonamento();
    const { data } = await supabase
      .from('equipe_medidas')
      .select('id, tipo, data_aplicacao, fundamento, status')
      .eq('colaborador_id', colaboradorId)
      .order('data_aplicacao', { ascending: false });
    setMedidasAplicadas(data ?? []);
  };

  // Os dados do PDF vêm inteiros do banco (equipe_dados_advertencia): empresa
  // correta, fatos, histórico e hashes. O front só desenha.
  const gerarPdf = async (medidaId: string) => {
    setGerandoPdfDe(medidaId);
    const { data, error } = await supabase.rpc('equipe_dados_advertencia', { p_medida_id: medidaId });
    setGerandoPdfDe(null);

    if (error || !data) {
      toast({
        title: 'Não foi possível gerar o PDF',
        description: error?.message,
        variant: 'destructive',
      });
      return;
    }

    downloadAdvertenciaPdf(data as unknown as DadosAdvertencia);
  };

  const subirScanAssinado = async (medidaId: string, arquivo: File) => {
    setSubindoDe(medidaId);
    const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'pdf';
    const caminho = `medidas/${medidaId}/assinado.${extensao}`;

    const { error: uploadError } = await supabase.storage
      .from('equipe-docs')
      .upload(caminho, arquivo, { upsert: true });

    if (uploadError) {
      setSubindoDe(null);
      toast({ title: 'Falha no upload', description: uploadError.message, variant: 'destructive' });
      return;
    }

    const { error: rpcError } = await supabase.rpc('equipe_registrar_assinatura_medida', {
      p_medida_id: medidaId,
      p_assinado_path: caminho,
    });
    setSubindoDe(null);

    if (rpcError) {
      toast({
        title: 'Arquivo enviado, mas a medida não foi fechada',
        description: rpcError.message,
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Medida aplicada', description: 'Documento assinado anexado.' });
    if (colaboradorId) {
      const { data } = await supabase
        .from('equipe_medidas')
        .select('id, tipo, data_aplicacao, fundamento, status')
        .eq('colaborador_id', colaboradorId)
        .order('data_aplicacao', { ascending: false });
      setMedidasAplicadas(data ?? []);
    }
  };

  const toggleAtraso = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tiposDisponiveis: MedidaTipo[] = isEquipeAdmin
    ? ['orientacao_verbal', 'advertencia_escrita', 'suspensao']
    : ['orientacao_verbal', 'advertencia_escrita'];

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#12121a] border-blue-500/20 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-baseline gap-3 rounded-lg border border-blue-500/20 bg-[#0c0c14] p-4">
            <span className="font-mono text-4xl font-bold tabular-nums text-white">
              {contagem ?? '—'}
            </span>
            <div>
              <p className="text-sm text-blue-300/70">atrasos que contam neste mês</p>
              <p className="text-xs text-blue-300/50">
                fora da tolerância, não abonados e ainda sem medida
              </p>
            </div>
            {sugestao && (
              <div className="ml-auto text-right">
                <p className="text-[10px] uppercase tracking-wider text-blue-300/40 mb-1">sugestão</p>
                <EquipeMedidaBadge tipo={sugestao} />
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-white mb-2">Linha do tempo</h4>
            <div className="rounded-lg border border-blue-500/20 divide-y divide-blue-500/10">
              {atrasos.length === 0 ? (
                <p className="text-sm text-blue-300/50 p-4">Nenhum atraso registrado.</p>
              ) : (
                atrasos.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 p-3">
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
            </div>
          </div>

          {medidasAplicadas.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white mb-2">Medidas anteriores</h4>
              <div className="rounded-lg border border-blue-500/20 divide-y divide-blue-500/10">
                {medidasAplicadas.map((m) => (
                  <div key={m.id} className="p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-xs text-blue-300/60 tabular-nums">
                        {formatarData(m.data_aplicacao)}
                      </span>
                      <EquipeMedidaBadge tipo={m.tipo} />
                      <span className="text-xs text-blue-300/50 flex-1 min-w-[10rem]">
                        {m.fundamento}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-blue-300/40">
                        {m.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Verbal não gera PDF (PRD 5.4) — fica só com a ciência eletrônica. */}
                    {m.tipo !== 'orientacao_verbal' && m.tipo !== 'orientacao_verbal_coletiva' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => gerarPdf(m.id)}
                          disabled={gerandoPdfDe === m.id}
                          className="h-9 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-white"
                        >
                          {gerandoPdfDe === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                          ) : (
                            <FileDown className="h-3.5 w-3.5 mr-2" />
                          )}
                          Gerar PDF
                        </Button>

                        {m.status !== 'aplicada' && (
                          <label className="inline-flex">
                            <input
                              type="file"
                              accept="application/pdf,image/*"
                              className="hidden"
                              onChange={(e) => {
                                const arquivo = e.target.files?.[0];
                                if (arquivo) subirScanAssinado(m.id, arquivo);
                                e.target.value = '';
                              }}
                            />
                            <span
                              className={cn(
                                'inline-flex items-center h-9 px-3 rounded-md border text-xs cursor-pointer transition-colors',
                                'border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-white',
                                subindoDe === m.id && 'opacity-60 pointer-events-none'
                              )}
                            >
                              {subindoDe === m.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                              ) : (
                                <Upload className="h-3.5 w-3.5 mr-2" />
                              )}
                              Subir assinado
                            </span>
                          </label>
                        )}

                        {m.status !== 'aplicada' && (
                          <span className="text-[11px] text-blue-300/40">
                            A medida só fica aplicada depois do documento assinado.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-blue-500/20 bg-[#0c0c14] p-4 space-y-4">
            <h4 className="text-sm font-medium text-white">Aplicar medida</h4>

            <div className="flex flex-wrap gap-2">
              {tiposDisponiveis.map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setModoMedida(tipo)}
                  className={cn(
                    'h-10 px-3 rounded-lg border text-xs transition-colors',
                    modoMedida === tipo
                      ? 'bg-blue-600/30 border-blue-500/40 text-white font-medium'
                      : 'bg-[#12121a] border-blue-500/20 text-blue-300/70 hover:bg-blue-500/10',
                    tipo === 'suspensao' && 'border-[#C0392B]/40 text-[#C0392B]'
                  )}
                >
                  {MEDIDA_LABEL[tipo]}
                </button>
              ))}
            </div>

            {modoMedida === 'suspensao' && (
              <div className="rounded-lg border border-[#C0392B]/40 bg-[#C0392B]/10 p-3 space-y-2">
                <p className="text-xs text-[#C0392B] flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  Suspensão nunca é sugerida pelo sistema e só admin aplica. Confira a proporcionalidade
                  antes.
                </p>
                <div className="space-y-1">
                  <Label className="text-blue-300/70 text-xs">Dias de suspensão</Label>
                  <Input
                    inputMode="numeric"
                    value={diasSuspensao}
                    onChange={(e) => setDiasSuspensao(e.target.value.replace(/\D/g, ''))}
                    className="bg-[#12121a] border-blue-500/20 h-11 font-mono w-24 [color-scheme:dark] text-white placeholder:text-blue-300/40"
                  />
                </div>
              </div>
            )}

            {atrasosLivres.length > 0 && (
              <div className="space-y-2">
                <Label className="text-blue-300/70 text-xs">
                  Atrasos que fundamentam esta medida
                </Label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {atrasosLivres.map((a) => (
                    <label
                      key={a.id}
                      className="flex items-center gap-3 text-xs text-blue-300/70 cursor-pointer py-1"
                    >
                      <input
                        type="checkbox"
                        checked={selecionados.has(a.id)}
                        onChange={() => toggleAtraso(a.id)}
                        className="h-4 w-4 accent-blue-600"
                      />
                      <span className="font-mono tabular-nums">{formatarData(a.data)}</span>
                      <span>{a.minutos_atraso} min</span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-blue-300/40">
                  Um atraso só pode fundamentar uma medida. Depois de vinculado, ele sai desta lista.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-blue-300/70 text-xs">Fundamento</Label>
              <Textarea
                value={fundamento}
                onChange={(e) => setFundamento(e.target.value)}
                rows={3}
                placeholder="Descreva os fatos e a base da medida."
                className="bg-[#12121a] border-blue-500/20 text-white placeholder:text-blue-300/40"
              />
            </div>

            <Button
              onClick={aplicarMedida}
              disabled={!modoMedida || !fundamento.trim() || aplicando}
              className="bg-blue-600 hover:bg-blue-500 w-full h-11"
            >
              {aplicando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {modoMedida ? `Registrar ${MEDIDA_LABEL[modoMedida]}` : 'Escolha a medida'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FichaColaboradorDialog;

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';
import type { EquipeColaborador, PresenteNaPorta, PreviaAtraso } from '@/hooks/useEquipe';

type Marcacao = Database['public']['Enums']['equipe_marcacao'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaboradores: EquipeColaborador[];
  empresaId: string | null;
  data: string;
  aberturaAtrasada: boolean;
  /** Quem foi marcado na porta ao registrar a abertura — pré-preenche o campo. */
  presentes: PresenteNaPorta[];
  colaboradorInicial?: string | null;
  pedirPrevia: (params: {
    colaboradorId: string;
    empresaId: string;
    data: string;
    marcacao: Marcacao;
    horaChegada: string;
    estavaNaPorta?: boolean;
    horaChegadaPorta?: string | null;
    saidaAlmocoReal?: string | null;
  }) => Promise<PreviaAtraso | null>;
  onLancar: (params: {
    colaboradorId: string;
    empresaId: string;
    data: string;
    marcacao: Marcacao;
    horaChegada: string;
    estavaNaPorta?: boolean;
    horaChegadaPorta?: string | null;
    saidaAlmocoReal?: string | null;
  }) => Promise<boolean>;
}

const horaValida = (valor: string) => /^\d{2}:\d{2}$/.test(valor);

const LancarAtrasoDialog = ({
  open,
  onOpenChange,
  colaboradores,
  empresaId,
  data,
  aberturaAtrasada,
  presentes,
  colaboradorInicial,
  pedirPrevia,
  onLancar,
}: Props) => {
  const [colaboradorId, setColaboradorId] = useState<string>('');
  const [marcacao, setMarcacao] = useState<Marcacao>('entrada');
  const [horaChegada, setHoraChegada] = useState('');
  const [estavaNaPorta, setEstavaNaPorta] = useState(false);
  const [horaChegadaPorta, setHoraChegadaPorta] = useState('');
  const [saidaAlmocoReal, setSaidaAlmocoReal] = useState('');
  const [previa, setPrevia] = useState<PreviaAtraso | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setColaboradorId(colaboradorInicial ?? '');
      setMarcacao('entrada');
      setHoraChegada('');
      setEstavaNaPorta(false);
      setHoraChegadaPorta('');
      setSaidaAlmocoReal('');
      setPrevia(null);
    }
  }, [open, colaboradorInicial]);

  // Se a pessoa foi marcada como presente na porta quando a abertura foi
  // registrada, já vem preenchido — o gestor só confirma, em vez de lembrar.
  useEffect(() => {
    if (!colaboradorId) return;
    const presente = presentes.find((p) => p.colaborador_id === colaboradorId);
    setEstavaNaPorta(Boolean(presente));
    setHoraChegadaPorta(presente?.hora_chegada_porta?.slice(0, 5) ?? '');
  }, [colaboradorId, presentes]);

  const camposCompletos =
    Boolean(colaboradorId) &&
    Boolean(empresaId) &&
    horaValida(horaChegada) &&
    (marcacao === 'entrada' || horaValida(saidaAlmocoReal));

  // A prévia sempre vem do banco (RPC equipe_calcular_atraso). Nenhuma regra
  // de tolerância/porta/almoço é reimplementada aqui.
  useEffect(() => {
    if (!open || !camposCompletos || !empresaId) {
      setPrevia(null);
      return;
    }
    let cancelado = false;
    setCalculando(true);
    const timer = setTimeout(async () => {
      const resultado = await pedirPrevia({
        colaboradorId,
        empresaId,
        data,
        marcacao,
        horaChegada,
        estavaNaPorta,
        horaChegadaPorta: estavaNaPorta && horaValida(horaChegadaPorta) ? horaChegadaPorta : null,
        saidaAlmocoReal: marcacao === 'retorno_almoco' ? saidaAlmocoReal : null,
      });
      if (!cancelado) {
        setPrevia(resultado);
        setCalculando(false);
      }
    }, 250);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [
    open,
    camposCompletos,
    colaboradorId,
    empresaId,
    data,
    marcacao,
    horaChegada,
    estavaNaPorta,
    horaChegadaPorta,
    saidaAlmocoReal,
    pedirPrevia,
  ]);

  const salvar = async () => {
    if (!camposCompletos || !empresaId) return;
    setSalvando(true);
    const ok = await onLancar({
      colaboradorId,
      empresaId,
      data,
      marcacao,
      horaChegada,
      estavaNaPorta,
      horaChegadaPorta: estavaNaPorta && horaValida(horaChegadaPorta) ? horaChegadaPorta : null,
      saidaAlmocoReal: marcacao === 'retorno_almoco' ? saidaAlmocoReal : null,
    });
    setSalvando(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#12121a] border-blue-500/20 text-white max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Lançar atraso</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-blue-300/70">Colaborador</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger className="bg-[#0c0c14] border-blue-500/20 h-11 text-white placeholder:text-blue-300/40">
                <SelectValue placeholder="Quem chegou atrasado?" />
              </SelectTrigger>
              <SelectContent className="bg-[#12121a] border-blue-500/20 text-white">
                {colaboradores.map((c) => (
                  <SelectItem key={c.user_id} value={c.user_id}>
                    {c.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-blue-300/70">Marcação</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['entrada', 'retorno_almoco'] as Marcacao[]).map((valor) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setMarcacao(valor)}
                  className={cn(
                    'h-11 rounded-lg border text-sm transition-colors',
                    marcacao === valor
                      ? 'bg-blue-600/30 border-blue-500/40 text-white font-medium'
                      : 'bg-[#0c0c14] border-blue-500/20 text-blue-300/70 hover:bg-blue-500/10'
                  )}
                >
                  {valor === 'entrada' ? 'Entrada' : 'Retorno do almoço'}
                </button>
              ))}
            </div>
          </div>

          {marcacao === 'retorno_almoco' && (
            <div className="space-y-2">
              <Label className="text-blue-300/70">Saiu para o almoço às</Label>
              <Input
                type="time"
                inputMode="numeric"
                value={saidaAlmocoReal}
                onChange={(e) => setSaidaAlmocoReal(e.target.value)}
                className="bg-[#0c0c14] border-blue-500/20 h-11 font-mono [color-scheme:dark] text-white placeholder:text-blue-300/40"
              />
              <p className="text-xs text-blue-300/50">
                O retorno esperado sai daqui + a duração do almoço do cadastro, não de um horário fixo.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-blue-300/70">
              {marcacao === 'entrada' ? 'Chegou às' : 'Voltou às'}
            </Label>
            <Input
              type="time"
              inputMode="numeric"
              value={horaChegada}
              onChange={(e) => setHoraChegada(e.target.value)}
              className="bg-[#0c0c14] border-blue-500/20 h-11 font-mono text-lg [color-scheme:dark] text-white placeholder:text-blue-300/40"
            />
          </div>

          {marcacao === 'entrada' && aberturaAtrasada && (
            <div className="rounded-lg border border-blue-500/20 bg-[#0c0c14] p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-white text-sm">Estava na porta?</Label>
                  <p className="text-xs text-blue-300/50 mt-0.5">
                    A loja abriu atrasada hoje.
                  </p>
                </div>
                <Switch checked={estavaNaPorta} onCheckedChange={setEstavaNaPorta} />
              </div>

              {estavaNaPorta && (
                <div className="space-y-2">
                  <Label className="text-blue-300/70">Chegou na porta às (opcional)</Label>
                  <Input
                    type="time"
                    inputMode="numeric"
                    value={horaChegadaPorta}
                    onChange={(e) => setHoraChegadaPorta(e.target.value)}
                    className="bg-[#12121a] border-blue-500/20 h-11 font-mono [color-scheme:dark] text-white placeholder:text-blue-300/40"
                  />
                  <p className="text-xs text-blue-300/50">
                    Sem isso, a referência passa a ser a hora da abertura.
                  </p>
                </div>
              )}
            </div>
          )}

          <div
            className={cn(
              'rounded-lg border p-4 min-h-[92px] flex flex-col justify-center',
              previa && !previa.dentro_tolerancia
                ? 'border-[#C0392B]/40 bg-[#C0392B]/10'
                : previa
                  ? 'border-[#2F9E44]/40 bg-[#2F9E44]/10'
                  : 'border-blue-500/20 bg-[#0c0c14]'
            )}
          >
            {!camposCompletos && (
              <p className="text-sm text-blue-300/50">
                Preencha os horários para ver o cálculo.
              </p>
            )}

            {camposCompletos && calculando && (
              <p className="text-sm text-blue-300/60 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Calculando no servidor...
              </p>
            )}

            {camposCompletos && !calculando && previa && (
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      'font-mono text-3xl font-bold tabular-nums',
                      previa.dentro_tolerancia ? 'text-[#2F9E44]' : 'text-[#C0392B]'
                    )}
                  >
                    {previa.minutos_atraso}
                  </span>
                  <span className="text-sm text-blue-300/70">
                    {previa.dentro_tolerancia ? 'min — dentro da tolerância' : 'min de atraso'}
                  </span>
                </div>
                <p className="text-xs text-blue-300/60 font-mono">
                  referência {previa.horario_referencia?.slice(0, 5)} · variação bruta{' '}
                  {previa.variacao_bruta_min} min · soma do dia {previa.soma_dia_min} min
                </p>
                {previa.desvio_saida_almoco_min != null && previa.desvio_saida_almoco_min !== 0 && (
                  <p className="text-xs text-blue-300/50">
                    Saída do almoço {previa.desvio_saida_almoco_min > 0 ? '+' : ''}
                    {previa.desvio_saida_almoco_min} min do previsto (só informativo).
                  </p>
                )}
                {!previa.dentro_tolerancia && previa.variacao_bruta_min <= 5 && (
                  <p className="text-xs text-[#C0392B]">
                    A soma do dia passou do limite, então todas as variações contam integralmente.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-blue-300/70 hover:text-white hover:bg-blue-500/10"
          >
            Cancelar
          </Button>
          <Button
            onClick={salvar}
            disabled={!camposCompletos || salvando || calculando}
            className="bg-blue-600 hover:bg-blue-500"
          >
            {salvando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Lançar atraso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LancarAtrasoDialog;

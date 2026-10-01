import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MARCACAO_LABEL,
  TIPO_LABEL,
  TIPOS_DO_COLABORADOR,
  type JustificativaTipo,
  type Marcacao,
  type MarcacaoPonto,
} from '@/hooks/useJustificativaPonto';
import type { EquipeAtraso } from '@/hooks/useEquipe';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaboradorId: string;
  /** Gestor vê os tipos todos (inclusive intervalo reduzido) e pode lançar em nome de alguém. */
  isGestor: boolean;
  /** Atrasos do próprio dia, pra compensação apontar pra um deles. */
  atrasos: EquipeAtraso[];
  onCriar: (params: {
    colaboradorId: string;
    data: string;
    tipo: JustificativaTipo;
    motivo: string;
    marcacoes: Marcacao[];
    atrasoId?: string | null;
    valorPago?: number | null;
  }) => Promise<boolean>;
}

const hojeISO = () => new Date().toISOString().slice(0, 10);

const MARCACOES_DISPONIVEIS: MarcacaoPonto[] = [
  'entrada',
  'saida_almoco',
  'retorno_almoco',
  'saida',
  'hora_extra_inicio',
  'hora_extra_saida',
  'saida_intermediaria',
  'retorno_intermediario',
];

const JustificarPontoDialog = ({
  open,
  onOpenChange,
  colaboradorId,
  isGestor,
  atrasos,
  onCriar,
}: Props) => {
  const [data, setData] = useState(hojeISO());
  const [tipo, setTipo] = useState<JustificativaTipo>('esquecimento');
  const [motivo, setMotivo] = useState('');
  const [marcacoes, setMarcacoes] = useState<Marcacao[]>([]);
  const [atrasoId, setAtrasoId] = useState<string>('');
  const [valorPago, setValorPago] = useState('30');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (open) {
      setData(hojeISO());
      setTipo('atraso');
      setMotivo('');
      setMarcacoes([{ marcacao: 'entrada', horario: '' }]);
      setAtrasoId('');
      setValorPago('30');
    }
  }, [open]);

  // "Cheguei atrasado" só precisa da hora de entrada. Já deixa a linha pronta
  // em vez de a pessoa ter que descobrir que precisa adicionar uma marcação.
  useEffect(() => {
    if (!open) return;
    if (tipo === 'atraso' && marcacoes.length === 0) {
      setMarcacoes([{ marcacao: 'entrada', horario: '' }]);
    }
  }, [tipo, open, marcacoes.length]);

  const tiposDisponiveis = isGestor
    ? ([...TIPOS_DO_COLABORADOR, 'intervalo_reduzido_empresa', 'falha_sistema'] as JustificativaTipo[])
    : TIPOS_DO_COLABORADOR;

  const atrasosDoDia = useMemo(
    () => atrasos.filter((a) => a.data === data && a.dentro_tolerancia === false),
    [atrasos, data]
  );

  // Prévia do intervalo, só pra pessoa ver antes de enviar — a validação que
  // vale é a do banco, que recusa o envio se estiver abaixo do mínimo.
  const intervalo = useMemo(() => {
    const saida = marcacoes.find((m) => m.marcacao === 'saida_almoco')?.horario;
    const retorno = marcacoes.find((m) => m.marcacao === 'retorno_almoco')?.horario;
    if (!saida || !retorno) return null;
    const [hs, ms] = saida.split(':').map(Number);
    const [hr, mr] = retorno.split(':').map(Number);
    return hr * 60 + mr - (hs * 60 + ms);
  }, [marcacoes]);

  const adicionarMarcacao = () => {
    const usadas = new Set(marcacoes.map((m) => m.marcacao));
    const proxima = MARCACOES_DISPONIVEIS.find((m) => !usadas.has(m));
    if (!proxima) return;
    setMarcacoes([...marcacoes, { marcacao: proxima, horario: '' }]);
  };

  const atualizarMarcacao = (index: number, campo: keyof Marcacao, valor: string) => {
    setMarcacoes(
      marcacoes.map((m, i) => (i === index ? { ...m, [campo]: valor } : m))
    );
  };

  const podeEnviar =
    motivo.trim().length >= 5 &&
    marcacoes.length > 0 &&
    marcacoes.every((m) => /^\d{2}:\d{2}$/.test(m.horario)) &&
    (tipo !== 'compensacao_atraso' || Boolean(atrasoId));

  const enviar = async () => {
    setEnviando(true);
    const ok = await onCriar({
      colaboradorId,
      data,
      tipo,
      motivo: motivo.trim(),
      marcacoes,
      atrasoId: tipo === 'compensacao_atraso' ? atrasoId : null,
      valorPago: tipo === 'intervalo_reduzido_empresa' ? Number(valorPago) || null : null,
    });
    setEnviando(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#12121a] border-blue-500/20 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Reportar o que aconteceu</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-blue-300/70 text-xs">Dia</Label>
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="bg-[#0c0c14] border-blue-500/20 h-11 font-mono [color-scheme:dark] text-white placeholder:text-blue-300/40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-blue-300/70 text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as JustificativaTipo)}>
                <SelectTrigger className="bg-[#0c0c14] border-blue-500/20 h-11 text-white placeholder:text-blue-300/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#12121a] border-blue-500/20 text-white">
                  {tiposDisponiveis.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tipo === 'compensacao_atraso' && (
            <div className="space-y-1">
              <Label className="text-blue-300/70 text-xs">Atraso que está sendo compensado</Label>
              {atrasosDoDia.length === 0 ? (
                <p className="text-xs text-[#f0b429]">
                  Nenhum atraso registrado neste dia. A compensação só vale para um atraso do mesmo
                  dia.
                </p>
              ) : (
                <Select value={atrasoId} onValueChange={setAtrasoId}>
                  <SelectTrigger className="bg-[#0c0c14] border-blue-500/20 h-11 text-white placeholder:text-blue-300/40">
                    <SelectValue placeholder="Escolha o atraso" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12121a] border-blue-500/20 text-white">
                    {atrasosDoDia.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.marcacao === 'entrada' ? 'Entrada' : 'Retorno do almoço'} —{' '}
                        {a.minutos_atraso} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {tipo === 'intervalo_reduzido_empresa' && (
            <div className="space-y-1">
              <Label className="text-blue-300/70 text-xs">Valor pago (R$)</Label>
              <Input
                inputMode="decimal"
                value={valorPago}
                onChange={(e) => setValorPago(e.target.value.replace(/[^\d.,]/g, ''))}
                className="bg-[#0c0c14] border-blue-500/20 h-11 font-mono w-32 [color-scheme:dark] text-white placeholder:text-blue-300/40"
              />
              <p className="text-xs text-blue-300/50">
                Entra no relatório como rubrica própria, pra ser pago no holerite — não por fora.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-blue-300/70 text-xs">Marcações do dia</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={adicionarMarcacao}
                className="text-blue-300/70 hover:text-white hover:bg-blue-500/10 h-8"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar
              </Button>
            </div>

            {marcacoes.length === 0 && (
              <p className="text-xs text-blue-300/50">
                Adicione os horários que precisam ser corrigidos. Cada um com seu tipo — é o que
                tirava a ambiguidade do caderno.
              </p>
            )}

            {marcacoes.map((m, i) => (
              <div key={i} className="flex gap-2">
                <Select
                  value={m.marcacao}
                  onValueChange={(v) => atualizarMarcacao(i, 'marcacao', v)}
                >
                  <SelectTrigger className="bg-[#0c0c14] border-blue-500/20 h-11 flex-1 text-white placeholder:text-blue-300/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12121a] border-blue-500/20 text-white">
                    {MARCACOES_DISPONIVEIS.map((opcao) => (
                      <SelectItem key={opcao} value={opcao}>
                        {MARCACAO_LABEL[opcao]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="time"
                  inputMode="numeric"
                  value={m.horario}
                  onChange={(e) => atualizarMarcacao(i, 'horario', e.target.value)}
                  className="bg-[#0c0c14] border-blue-500/20 h-11 font-mono w-28 [color-scheme:dark] text-white placeholder:text-blue-300/40"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setMarcacoes(marcacoes.filter((_, idx) => idx !== i))}
                  className="h-11 w-11 text-blue-300/50 hover:text-white hover:bg-blue-500/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {intervalo !== null && (
              <p
                className={cn(
                  'text-xs font-mono',
                  intervalo < 60 ? 'text-[#C0392B]' : 'text-[#2F9E44]'
                )}
              >
                intervalo de almoço: {intervalo} min
                {intervalo < 60 && tipo === 'compensacao_atraso' && (
                  <span className="font-sans">
                    {' '}
                    — abaixo do mínimo de 60 min, não serve para compensar atraso
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-blue-300/70 text-xs">Conte com as suas palavras</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ex.: o sistema de ponto não ligou e anotamos no caderno."
              className="bg-[#0c0c14] border-blue-500/20 text-white placeholder:text-blue-300/40"
            />
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
            onClick={enviar}
            disabled={!podeEnviar || enviando}
            className="bg-blue-600 hover:bg-blue-500"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JustificarPontoDialog;

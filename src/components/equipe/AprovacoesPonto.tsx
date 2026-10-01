import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Check, X } from 'lucide-react';
import {
  STATUS_LABEL,
  TIPO_LABEL,
  type JustificativaPonto,
} from '@/hooks/useJustificativaPonto';

interface Props {
  justificativas: JustificativaPonto[];
  loading: boolean;
  nomePorId: Map<string, string>;
  onDecidir: (id: string, aprovar: boolean, motivoRejeicao?: string) => Promise<boolean>;
}

const formatarData = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const AprovacoesPonto = ({ justificativas, loading, nomePorId, onDecidir }: Props) => {
  const [rejeitandoId, setRejeitandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [processando, setProcessando] = useState<string | null>(null);

  const pendentes = justificativas.filter((j) => j.status === 'pendente');

  const aprovar = async (id: string) => {
    setProcessando(id);
    await onDecidir(id, true);
    setProcessando(null);
  };

  const rejeitar = async (id: string) => {
    if (motivo.trim().length < 5) return;
    setProcessando(id);
    const ok = await onDecidir(id, false, motivo.trim());
    setProcessando(null);
    if (ok) {
      setRejeitandoId(null);
      setMotivo('');
    }
  };

  if (loading) {
    return (
      <Card className="bg-[#12121a] border-blue-500/20">
        <CardContent className="pt-6">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#12121a] border-blue-500/20">
      <CardContent className="pt-6">
        {pendentes.length === 0 ? (
          <p className="text-sm text-blue-300/60 py-4">
            Nenhuma solicitação aguardando decisão.
          </p>
        ) : (
          <div className="divide-y divide-blue-500/10">
            {pendentes.map((j) => (
              <div key={j.id} className="py-3 space-y-2 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-white">
                    {nomePorId.get(j.colaborador_id) ?? 'Colaborador'}
                  </span>
                  <span className="font-mono text-xs text-blue-300/60 tabular-nums">
                    {formatarData(j.data)}
                  </span>
                  <span className="text-xs text-blue-300/70">{TIPO_LABEL[j.tipo]}</span>
                  {j.intervalo_calculado_min != null && (
                    <span className="font-mono text-xs text-blue-300/50">
                      intervalo {j.intervalo_calculado_min} min
                    </span>
                  )}
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-[#f0b429] border-2 border-[#f0b429]/70 bg-[#f0b429]/10 rounded-[3px] px-2 py-0.5 -rotate-[1.5deg]">
                    {STATUS_LABEL[j.status]}
                  </span>
                </div>

                <p className="text-xs text-blue-300/60 border-l-2 border-blue-500/30 pl-3">
                  {j.motivo}
                </p>

                {/* Mostra o impacto antes de decidir, que é o que o PRD pede. */}
                {j.tipo === 'compensacao_atraso' && j.minutos_compensados != null && (
                  <p className="text-xs text-[#0F6B5C]">
                    Aprovar compensa{' '}
                    <span className="font-mono">{j.minutos_compensados} min</span> do atraso deste
                    dia — sai do desconto, mas continua contando no escalonamento.
                  </p>
                )}

                {rejeitandoId === j.id ? (
                  <div className="flex flex-wrap gap-2">
                    <Input
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Por que está rejeitando?"
                      className="bg-[#0c0c14] border-blue-500/20 h-10 flex-1 min-w-[12rem]"
                    />
                    <Button
                      size="sm"
                      onClick={() => rejeitar(j.id)}
                      disabled={motivo.trim().length < 5 || processando === j.id}
                      className="h-10 bg-[#C0392B] hover:bg-[#a63224]"
                    >
                      Confirmar rejeição
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRejeitandoId(null);
                        setMotivo('');
                      }}
                      className="h-10 text-blue-300/70 hover:text-white hover:bg-blue-500/10"
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => aprovar(j.id)}
                      disabled={processando === j.id}
                      className="h-10 bg-blue-600 hover:bg-blue-500"
                    >
                      {processando === j.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-2" />
                      )}
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRejeitandoId(j.id)}
                      className="h-10 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5 mr-2" />
                      Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AprovacoesPonto;

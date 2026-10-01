import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LinhaRelatorio {
  colaborador_id: string;
  colaborador: string;
  ocorrencias: number;
  minutos_desconto: number;
  ocorrencias_abonadas: number;
  ocorrencias_compensadas: number;
  minutos_compensados: number;
  ocorrencias_na_tolerancia: number;
  medidas_no_mes: number;
}

const competenciaAtual = () => new Date().toISOString().slice(0, 7);

const EquipeRelatorio = ({ empresaId }: { empresaId: string | null }) => {
  const { toast } = useToast();
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [linhas, setLinhas] = useState<LinhaRelatorio[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setLinhas([]);
      return;
    }
    setCarregando(true);
    const { data, error } = await supabase.rpc('equipe_relatorio_mensal', {
      p_empresa_id: empresaId,
      p_competencia: `${competencia}-01`,
    });
    setCarregando(false);

    if (error) {
      toast({ title: 'Não foi possível carregar', description: error.message, variant: 'destructive' });
      return;
    }
    setLinhas((data ?? []) as LinhaRelatorio[]);
  }, [empresaId, competencia, toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const exportarCsv = () => {
    const cabecalho = [
      'Colaborador',
      'Ocorrencias',
      'Minutos para desconto',
      'Abonadas',
      'Compensadas',
      'Minutos compensados',
      'Dentro da tolerancia',
      'Medidas no mes',
    ];

    // Ponto e vírgula + BOM: é o que o Excel em pt-BR abre sem embaralhar
    // coluna nem comer acento.
    const linhasCsv = linhas.map((l) =>
      [
        l.colaborador,
        l.ocorrencias,
        l.minutos_desconto,
        l.ocorrencias_abonadas,
        l.ocorrencias_compensadas,
        l.minutos_compensados,
        l.ocorrencias_na_tolerancia,
        l.medidas_no_mes,
      ]
        .map((campo) => (typeof campo === 'string' ? `"${campo.replace(/"/g, '""')}"` : campo))
        .join(';')
    );

    const conteudo = '﻿' + [cabecalho.join(';'), ...linhasCsv].join('\r\n');
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `atrasos-${competencia}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalMinutos = linhas.reduce((soma, l) => soma + l.minutos_desconto, 0);
  const temDados = linhas.some((l) => l.ocorrencias > 0 || l.ocorrencias_na_tolerancia > 0);

  return (
    <Card className="bg-[#12121a] border-blue-500/20">
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <Label className="text-blue-300/70 text-xs">Competência</Label>
            <Input
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="bg-[#0c0c14] border-blue-500/20 h-11 font-mono w-[11rem]"
            />
          </div>

          <Button
            variant="outline"
            onClick={exportarCsv}
            disabled={linhas.length === 0}
            className="h-11 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {carregando ? (
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
        ) : linhas.length === 0 ? (
          <p className="text-sm text-blue-300/60 py-4">
            Nenhum colaborador vinculado a esta empresa.
          </p>
        ) : !temDados ? (
          <p className="text-sm text-blue-300/60 py-4">
            Nenhum atraso registrado nesta competência.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-blue-500/20 text-left">
                    <th className="py-2 pr-4 font-medium text-blue-300/70">Colaborador</th>
                    <th className="py-2 px-3 font-medium text-blue-300/70 text-right">Ocorr.</th>
                    <th className="py-2 px-3 font-medium text-blue-300/70 text-right">
                      Min. desconto
                    </th>
                    <th className="py-2 px-3 font-medium text-blue-300/70 text-right">Abonadas</th>
                    <th className="py-2 px-3 font-medium text-blue-300/70 text-right">Compens.</th>
                    <th className="py-2 px-3 font-medium text-blue-300/70 text-right">Na tolerância</th>
                    <th className="py-2 pl-3 font-medium text-blue-300/70 text-right">Medidas</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.colaborador_id} className="border-b border-blue-500/10 last:border-0">
                      <td className="py-2 pr-4 text-white">{l.colaborador}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-blue-300/80">
                        {l.ocorrencias}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-mono tabular-nums font-semibold ${
                          l.minutos_desconto > 0 ? 'text-[#C0392B]' : 'text-blue-300/50'
                        }`}
                      >
                        {l.minutos_desconto}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-blue-300/50">
                        {l.ocorrencias_abonadas}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-blue-300/50">
                        {l.ocorrencias_compensadas}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-[#2F9E44]">
                        {l.ocorrencias_na_tolerancia}
                      </td>
                      <td className="py-2 pl-3 text-right font-mono tabular-nums text-blue-300/80">
                        {l.medidas_no_mes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-blue-300/50">
              Total do mês:{' '}
              <span className="font-mono tabular-nums text-white">{totalMinutos}</span> minutos para
              desconto. Atrasos abonados e compensados ficam de fora dessa conta — compensados ainda
              contam no escalonamento, mas já foram pagos com trabalho no mesmo dia.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default EquipeRelatorio;

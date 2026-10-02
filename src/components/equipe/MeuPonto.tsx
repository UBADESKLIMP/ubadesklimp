import { Loader2, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TIPO_LABEL as PONTO_TIPO_LABEL, type MinhaMarcacao } from '@/hooks/usePonto';

interface Props {
  marcacoes: MinhaMarcacao[];
  pendentes: MinhaMarcacao[];
  loading: boolean;
  responder: (marcacaoId: string, confirma: boolean) => Promise<boolean>;
}

const CARD = 'bg-[#12121a] border-blue-500/20 text-white';

const diaDe = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

const horaDe = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const MeuPonto = ({ marcacoes, pendentes, loading, responder }: Props) => {
  // Agrupa por dia pra pessoa conferir a jornada, não uma lista corrida.
  const porDia = marcacoes.reduce<Map<string, MinhaMarcacao[]>>((mapa, m) => {
    const chave = diaDe(m.registrado_em);
    mapa.set(chave, [...(mapa.get(chave) ?? []), m]);
    return mapa;
  }, new Map());

  if (loading) {
    return (
      <Card className={CARD}>
        <CardContent className="pt-6">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {pendentes.length > 0 && (
        <Card className="bg-[#f0b429]/10 border-[#f0b429]/40 text-white">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-[#f0b429] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-white">
                  {pendentes.length === 1
                    ? 'Alguém bateu uma entrada por você'
                    : `Alguém bateu ${pendentes.length} entradas por você`}
                </p>
                <p className="text-xs text-[#f0b429]/80 mt-0.5">
                  Confirme se o horário está certo. Sem resposta em 48 horas, conta como confirmado.
                </p>
              </div>
            </div>

            {pendentes.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-[#f0b429]/30 bg-[#12121a] px-3 py-2.5"
              >
                <span className="font-mono text-base tabular-nums text-white">
                  {horaDe(m.registrado_em)}
                </span>
                <span className="text-sm text-blue-300/70 flex-1 min-w-0">
                  {PONTO_TIPO_LABEL[m.tipo]} · {diaDe(m.registrado_em)}
                </span>
                <Button
                  size="sm"
                  className="h-10 bg-[#2F9E44] hover:bg-[#2F9E44]/80"
                  onClick={() => responder(m.id, true)}
                >
                  Estava certo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 border-[#C0392B]/40 text-[#ff8a7a] hover:bg-[#C0392B]/10 hover:text-white"
                  onClick={() => responder(m.id, false)}
                >
                  Não foi isso
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className={CARD}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-blue-400" />
            <p className="text-sm text-white">Suas batidas dos últimos 14 dias</p>
          </div>
          <p className="text-xs text-blue-300/50 mb-4">
            Cada batida tem um código próprio que prova que ela não foi alterada depois.
          </p>

          {marcacoes.length === 0 ? (
            <p className="text-sm text-blue-300/60 py-2">
              Nenhuma batida registrada ainda. O ponto fica no computador da loja.
            </p>
          ) : (
            <div className="space-y-4">
              {[...porDia.entries()].map(([dia, lista]) => (
                <div key={dia}>
                  <p className="text-xs uppercase tracking-wide text-blue-300/50 mb-1.5">{dia}</p>
                  <div className="flex flex-wrap gap-2">
                    {[...lista].reverse().map((m) => (
                      <div
                        key={m.id}
                        className="rounded-lg border border-blue-500/10 bg-[#0c0c14] px-3 py-2"
                      >
                        <p className="font-mono text-base text-white tabular-nums">
                          {horaDe(m.registrado_em)}
                        </p>
                        <p className="text-[11px] text-blue-300/60">{PONTO_TIPO_LABEL[m.tipo]}</p>
                        <p className="font-mono text-[10px] text-blue-300/30">
                          {m.hash.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MeuPonto;

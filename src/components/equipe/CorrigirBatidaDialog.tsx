import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TIPO_LABEL, type MarcacaoDoDia } from '@/hooks/usePonto';

interface Props {
  batida: MarcacaoDoDia | null;
  /** O dia da batida, para montar a hora nova sem trocar a data. */
  dia: string;
  onFechar: () => void;
  onCorrigir: (
    marcacaoId: string,
    quando: string,
    motivo: string
  ) => Promise<{ ok: boolean; mensagem?: string }>;
}

/**
 * Corrigir a hora de uma batida. Pede só a hora certa e o porquê — a data vem
 * do dia que está aberto na tela, porque corrigir hora é o caso real; mudar de
 * dia seria outra batida.
 */
const CorrigirBatidaDialog = ({ batida, dia, onFechar, onCorrigir }: Props) => {
  const [hora, setHora] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setHora(batida?.hora ?? '');
    setMotivo('');
    setErro(null);
  }, [batida]);

  const salvar = async () => {
    if (!batida) return;
    setErro(null);
    setSalvando(true);
    const r = await onCorrigir(batida.id, new Date(`${dia}T${hora}`).toISOString(), motivo);
    setSalvando(false);
    if (!r.ok) {
      setErro(r.mensagem ?? 'Não foi possível corrigir.');
      return;
    }
    onFechar();
  };

  const completo = /^\d{2}:\d{2}$/.test(hora) && motivo.trim().length >= 5;

  return (
    <Dialog open={Boolean(batida)} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="bg-[#12121a] border-blue-500/20 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle>Corrigir a hora</DialogTitle>
        </DialogHeader>

        {batida && (
          <div className="space-y-4">
            <p className="text-sm text-blue-300/70">
              {batida.nome} · {TIPO_LABEL[batida.tipo]} ·{' '}
              <span className="font-mono text-white">{batida.hora}</span>
            </p>

            <div className="space-y-1.5">
              <Label className="text-blue-300/70 text-xs">Hora certa</Label>
              <Input
                type="time"
                inputMode="numeric"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="bg-[#0c0c14] border-blue-500/20 h-12 font-mono text-lg w-32 text-white [color-scheme:dark]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-blue-300/70 text-xs">Por quê</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: bateu a saída na hora errada e avisou depois"
                className="bg-[#0c0c14] border-blue-500/20 text-white placeholder:text-blue-300/40 min-h-[64px]"
              />
              <p className="text-xs text-blue-300/50">
                A tela passa a mostrar a hora nova. {batida.nome.split(' ')[0]} confirma ou contesta
                em Meu ponto.
              </p>
            </div>

            {erro && <p className="text-sm text-[#ff8a7a]">{erro}</p>}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            className="text-blue-300/70 hover:text-white hover:bg-blue-500/10"
            onClick={onFechar}
          >
            Cancelar
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-500"
            disabled={!completo || salvando}
            onClick={salvar}
          >
            {salvando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Corrigir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CorrigirBatidaDialog;

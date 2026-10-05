import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TIPO_LABEL, type MarcacaoTipo, type PessoaDaEmpresa } from '@/hooks/usePonto';

const TIPOS: MarcacaoTipo[] = [
  'entrada',
  'saida_almoco',
  'retorno_almoco',
  'saida',
  'hora_extra_inicio',
  'hora_extra_saida',
];

const agoraLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

interface Props {
  aberto: boolean;
  pessoas: PessoaDaEmpresa[];
  /** Admin lança direto: sem justificar e sem a batida ficar pendente. */
  souAdmin: boolean;
  onFechar: () => void;
  onLancar: (
    funcionarioId: string,
    tipo: MarcacaoTipo,
    quando: string,
    motivo: string
  ) => Promise<{ ok: boolean; mensagem?: string }>;
}

/**
 * Lançar batida no lugar de alguém (PRD R7). Aqui a lista de nomes é certa:
 * quem lança é o gestor, que não sabe — nem deve saber — o PIN de ninguém.
 */
const LancarMarcacaoDialog = ({ aberto, pessoas, souAdmin, onFechar, onLancar }: Props) => {
  const [pessoa, setPessoa] = useState('');
  const [tipo, setTipo] = useState<MarcacaoTipo>('entrada');
  const [quando, setQuando] = useState(agoraLocal());
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const limpar = () => {
    setPessoa('');
    setTipo('entrada');
    setQuando(agoraLocal());
    setMotivo('');
    setErro(null);
  };

  const salvar = async () => {
    setErro(null);
    setSalvando(true);
    const r = await onLancar(pessoa, tipo, new Date(quando).toISOString(), motivo);
    setSalvando(false);
    if (!r.ok) {
      setErro(r.mensagem ?? 'Não foi possível lançar.');
      return;
    }
    limpar();
    onFechar();
  };

  const completo = Boolean(pessoa && quando && (souAdmin || motivo.trim().length >= 5));

  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        if (!o) {
          limpar();
          onFechar();
        }
      }}
    >
      <DialogContent className="bg-[#12121a] border-blue-500/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar batida por alguém</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!souAdmin && (
            <div className="flex items-start gap-2 rounded-lg bg-[#f0b429]/10 border border-[#f0b429]/30 p-3">
              <AlertTriangle className="h-4 w-4 text-[#f0b429] shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300/80">
                A batida sai com o seu nome e o motivo que você escrever, e a pessoa confirma ou
                contesta em Meu ponto. É assim que ela continua valendo como prova da jornada.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-blue-300/70 text-xs">Quem</Label>
            <Select value={pessoa} onValueChange={setPessoa}>
              <SelectTrigger className="bg-[#0c0c14] border-blue-500/20 h-11 text-white">
                <SelectValue placeholder="Escolha a pessoa" />
              </SelectTrigger>
              <SelectContent>
                {pessoas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-blue-300/70 text-xs">O quê</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as MarcacaoTipo)}>
                <SelectTrigger className="bg-[#0c0c14] border-blue-500/20 h-11 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-blue-300/70 text-xs">Quando</Label>
              <Input
                type="datetime-local"
                value={quando}
                max={agoraLocal()}
                onChange={(e) => setQuando(e.target.value)}
                className="bg-[#0c0c14] border-blue-500/20 h-11 font-mono text-white [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-blue-300/70 text-xs">
              Por quê {souAdmin && <span className="text-blue-300/40">· opcional</span>}
            </Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: o computador estava desligado na hora da entrada"
              className="bg-[#0c0c14] border-blue-500/20 text-white placeholder:text-blue-300/40 min-h-[72px]"
            />
            <p className="text-xs text-blue-300/50">
              {souAdmin
                ? 'Fica guardado junto com a batida, se você escrever.'
                : 'Fica guardado junto com a batida. Sem motivo o registro não vale como prova.'}
            </p>
          </div>

          {erro && <p className="text-sm text-[#ff8a7a]">{erro}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="text-blue-300/70 hover:text-white hover:bg-blue-500/10"
            onClick={() => {
              limpar();
              onFechar();
            }}
          >
            Cancelar
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-500"
            disabled={!completo || salvando}
            onClick={salvar}
          >
            {salvando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Lançar batida
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LancarMarcacaoDialog;

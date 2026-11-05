import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { normalizeText } from '@/lib/utils';
import type { BairroDeEntrega, ResultadoRpc } from '@/hooks/useEntregas';

export interface EntregaEmEdicao {
  entregaId: string;
  cliente: string;
  bairroAtual: string | null;
}

interface Props {
  entrega: EntregaEmEdicao | null;
  bairros: BairroDeEntrega[];
  onSalvar: (entregaId: string, bairroId: string | null, texto: string | null) => Promise<ResultadoRpc>;
  onFechar: () => void;
}

const OUTRO = '__outro__';
const CAMPO = 'h-11 w-full rounded-md border border-adm-line bg-adm-bg px-3 text-sm text-adm-ink';

/**
 * Corrige o bairro de UMA entrega. Escolher da lista dá a ordem certa na rota;
 * digitar outro nome serve para bairro que ainda não está cadastrado (a entrega
 * vai para o fim da rota até ele entrar em Bairros).
 */
const EditarBairroDialog = ({ entrega, bairros, onSalvar, onFechar }: Props) => {
  const ativos = bairros.filter((b) => b.ativo);
  const [escolha, setEscolha] = useState<string>(OUTRO);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Ao abrir, já vem marcado o bairro que a entrega tem hoje (se estiver na lista).
  useEffect(() => {
    if (!entrega) return;
    const atual = normalizeText(entrega.bairroAtual ?? '');
    const casado = atual ? ativos.find((b) => normalizeText(b.nome) === atual) : undefined;
    setEscolha(casado ? casado.id : OUTRO);
    setTexto(casado ? '' : (entrega.bairroAtual ?? ''));
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrega?.entregaId]);

  const salvar = async () => {
    if (!entrega) return;
    setSalvando(true);
    setErro(null);
    const r =
      escolha === OUTRO
        ? await onSalvar(entrega.entregaId, null, texto)
        : await onSalvar(entrega.entregaId, escolha, null);
    setSalvando(false);
    if (!r.ok) {
      setErro(r.mensagem ?? 'Não deu para salvar.');
      return;
    }
    onFechar();
  };

  return (
    <Dialog open={entrega !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar bairro</DialogTitle>
          <DialogDescription>{entrega?.cliente}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block space-y-1.5 text-sm text-adm-muted">
            Bairro
            <select value={escolha} onChange={(e) => setEscolha(e.target.value)} className={CAMPO}>
              {ativos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
              <option value={OUTRO}>Outro (escrever o nome)</option>
            </select>
          </label>

          {escolha === OUTRO && (
            <div className="space-y-1.5">
              <Input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Nome do bairro"
                className="h-11"
                autoFocus
              />
              <p className="text-xs text-adm-faint">
                Bairro fora da lista vai para o fim da rota. Cadastre em Bairros para ele entrar na ordem.
              </p>
            </div>
          )}

          {erro && <p className="text-sm text-adm-alert">{erro}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || (escolha === OUTRO && texto.trim() === '')} className="bg-adm-accent text-adm-on-accent hover:bg-adm-accent-strong">
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditarBairroDialog;

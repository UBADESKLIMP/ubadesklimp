import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export interface ItemDoPedido {
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fornecedor: string;
  itens: ItemDoPedido[];
  /** Salva as quantidades e gera o pedido. */
  onConfirmar: (quantidades: Record<string, number>) => Promise<void>;
}

const formatPrice = (value: number) =>
  `R$ ${value.toFixed(2).replace('.', ',')}`;

/**
 * Passo entre decidir os vencedores e disparar o pedido: mostra só o que ESTE
 * fornecedor ganhou e cobra a quantidade de cada item.
 *
 * Existe porque antes a quantidade só podia ser digitada num campo pequeno
 * dentro da planilha de comparação, preenchida antes de se saber quem venceu —
 * e item sem quantidade ia pro pedido como 1 unidade, sem avisar ninguém.
 */
const ConfirmarQuantidadesDialog = ({
  open,
  onOpenChange,
  fornecedor,
  itens,
  onConfirmar,
}: Props) => {
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuantidades(
      Object.fromEntries(itens.map((i) => [i.itemId, i.quantity ? String(i.quantity) : '']))
    );
  }, [open, itens]);

  const parsed = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const item of itens) {
      const valor = parseInt((quantidades[item.itemId] ?? '').trim(), 10);
      if (!Number.isNaN(valor) && valor > 0) mapa[item.itemId] = valor;
    }
    return mapa;
  }, [quantidades, itens]);

  const faltando = itens.filter((i) => !parsed[i.itemId]);
  const total = itens.reduce((soma, i) => soma + (parsed[i.itemId] ?? 0) * i.unitPrice, 0);

  const confirmar = async () => {
    if (faltando.length > 0) return;
    setSalvando(true);
    try {
      await onConfirmar(parsed);
      onOpenChange(false);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quantidades do pedido</DialogTitle>
          <DialogDescription>
            {fornecedor} ganhou {itens.length} item(ns). Informe quanto pedir de cada um antes de
            enviar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {itens.map((item) => {
            const valor = quantidades[item.itemId] ?? '';
            const qtd = parsed[item.itemId];
            return (
              <div
                key={item.itemId}
                className="flex items-center gap-3 border rounded-lg px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(item.unitPrice)} cada
                    {qtd ? ` · ${formatPrice(qtd * item.unitPrice)}` : ''}
                  </p>
                </div>
                <Input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  placeholder="Qtd"
                  value={valor}
                  onChange={(e) =>
                    setQuantidades((prev) => ({ ...prev, [item.itemId]: e.target.value }))
                  }
                  className="h-10 w-20 shrink-0"
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">
            {faltando.length > 0
              ? `Falta a quantidade de ${faltando.length} item(ns)`
              : `${itens.length} item(ns)`}
          </span>
          <span className="text-sm font-medium">Total: {formatPrice(total)}</span>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button onClick={confirmar} disabled={faltando.length > 0 || salvando}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Gerar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmarQuantidadesDialog;

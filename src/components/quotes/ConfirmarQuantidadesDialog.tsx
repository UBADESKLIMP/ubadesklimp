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
import { observacaoIndicaCaixa, unidadeSugerida, type UnidadeCompra } from '@/lib/unidadeCompra';

export type { UnidadeCompra } from '@/lib/unidadeCompra';

export interface ItemDoPedido {
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number | null;
  unidadeCompra: UnidadeCompra | null;
  /** Observação que o fornecedor mandou junto do preço, ex: "CXA 1X6". */
  observacao?: string | null;
}

export interface LinhaConfirmada {
  quantidade: number;
  unidadeCompra: UnidadeCompra;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fornecedor: string;
  itens: ItemDoPedido[];
  /** Já foi gerado antes: muda o texto, porque aqui é correção. */
  jaGerado?: boolean;
  /** Salva quantidades e unidades, depois gera o pedido. */
  onConfirmar: (linhas: Record<string, LinhaConfirmada>) => Promise<void>;
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
  jaGerado = false,
  onConfirmar,
}: Props) => {
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [unidades, setUnidades] = useState<Record<string, UnidadeCompra>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuantidades(
      Object.fromEntries(itens.map((i) => [i.itemId, i.quantity ? String(i.quantity) : '']))
    );
    setUnidades(
      Object.fromEntries(
        itens.map((i) => [i.itemId, unidadeSugerida(i.unidadeCompra, i.observacao)])
      )
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
      const linhas: Record<string, LinhaConfirmada> = {};
      for (const [itemId, quantidade] of Object.entries(parsed)) {
        linhas[itemId] = { quantidade, unidadeCompra: unidades[itemId] ?? 'unidade' };
      }
      await onConfirmar(linhas);
      onOpenChange(false);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {jaGerado ? 'Corrigir o pedido' : 'Quantidades do pedido'}
          </DialogTitle>
          <DialogDescription>
            {jaGerado
              ? `Ajuste o que precisar e gere o pedido de novo pra ${fornecedor}. O WhatsApp e o PDF passam a sair com os valores novos.`
              : `${fornecedor} ganhou ${itens.length} item(ns). Informe quanto pedir de cada um antes de enviar.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {itens.map((item) => {
            const valor = quantidades[item.itemId] ?? '';
            const qtd = parsed[item.itemId];
            return (
              <div
                key={item.itemId}
                className="flex flex-wrap items-center gap-2 border rounded-lg px-3 py-2"
              >
                <div className="flex-1 min-w-0 basis-48">
                  <p className="text-sm truncate">{item.name}</p>
                  {item.observacao && (
                    <p className="text-xs text-muted-foreground">
                      Fornecedor anotou: {item.observacao}
                      {!item.unidadeCompra && observacaoIndicaCaixa(item.observacao) && (
                        <span className="text-primary"> · marcamos cx por isso</span>
                      )}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(item.unitPrice)} cada
                    {qtd
                      ? ` · ${qtd} ${(unidades[item.itemId] ?? 'unidade') === 'caixa' ? 'cx' : 'un'} = ${formatPrice(qtd * item.unitPrice)}`
                      : ''}
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

                {/* "10" sozinho é ambíguo pro fornecedor: 10 frascos ou 10 caixas? */}
                <div className="flex shrink-0 rounded-md border overflow-hidden">
                  {(['unidade', 'caixa'] as UnidadeCompra[]).map((opcao) => {
                    const ativo = (unidades[item.itemId] ?? 'unidade') === opcao;
                    return (
                      <button
                        key={opcao}
                        type="button"
                        onClick={() =>
                          setUnidades((prev) => ({ ...prev, [item.itemId]: opcao }))
                        }
                        className={`h-10 w-11 text-xs font-medium transition-colors ${
                          ativo
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {opcao === 'caixa' ? 'cx' : 'un'}
                      </button>
                    );
                  })}
                </div>
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
            {jaGerado ? 'Salvar e gerar de novo' : 'Gerar pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmarQuantidadesDialog;

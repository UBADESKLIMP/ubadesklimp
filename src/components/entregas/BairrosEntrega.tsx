import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import type { BairroDeEntrega, ResultadoRpc } from '@/hooks/useEntregas';

const CARD = 'bg-[#12121a] border-blue-500/20 text-white';

const LinhaBairro = ({
  bairro,
  posicao,
  onAlternarAtivo,
}: {
  bairro: BairroDeEntrega;
  posicao: number;
  onAlternarAtivo: (b: BairroDeEntrega) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bairro.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${
        isDragging ? 'border-blue-500/60 bg-blue-600/10 shadow-lg' : 'border-blue-500/10'
      } ${bairro.ativo ? '' : 'opacity-50'}`}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Mover ${bairro.nome} de lugar`}
        className="shrink-0 cursor-grab touch-none text-blue-300/40 hover:text-blue-300 active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <span className="w-7 shrink-0 font-mono text-sm tabular-nums text-blue-300/40">
        {String(posicao).padStart(2, '0')}
      </span>

      <span className={`flex-1 truncate ${bairro.ativo ? 'text-white' : 'text-blue-300/50 line-through'}`}>
        {bairro.nome}
      </span>

      <button
        onClick={() => onAlternarAtivo(bairro)}
        aria-label={bairro.ativo ? `Parar de usar ${bairro.nome}` : `Voltar a usar ${bairro.nome}`}
        className="shrink-0 rounded p-2 text-blue-300/40 hover:bg-blue-600/10 hover:text-blue-300"
      >
        {bairro.ativo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </div>
  );
};

interface Props {
  bairros: BairroDeEntrega[];
  carregando: boolean;
  onGravarOrdem: (nova: BairroDeEntrega[]) => Promise<void>;
  onAdicionar: (nome: string) => Promise<ResultadoRpc>;
  onAlternarAtivo: (b: BairroDeEntrega) => void;
}

/**
 * A ordem desta lista É a rota. Ela nasceu num insert de migration, do extremo
 * norte ao extremo sul, e precisa da conferência de quem conhece a cidade: um
 * bairro no lugar errado faz a rota sair errada todo dia, e ninguém percebe de
 * imediato — o carro só roda mais.
 */
const BairrosEntrega = ({
  bairros,
  carregando,
  onGravarOrdem,
  onAdicionar,
  onAlternarAtivo,
}: Props) => {
  const [novo, setNovo] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const arrastou = async (evento: DragEndEvent) => {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;
    const de = bairros.findIndex((b) => b.id === active.id);
    const para = bairros.findIndex((b) => b.id === over.id);
    if (de < 0 || para < 0) return;
    setSalvando(true);
    await onGravarOrdem(arrayMove(bairros, de, para));
    setSalvando(false);
  };

  const adicionar = async () => {
    const r = await onAdicionar(novo);
    setAviso(r.mensagem ?? null);
    if (r.ok) setNovo('');
  };

  if (carregando && bairros.length === 0) {
    return <AdminLoadingState label="Carregando os bairros..." rows={6} />;
  }

  return (
    <Card className={CARD}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-white">
          Bairros, do norte para o sul
          {salvando && <span className="ml-2 text-xs font-normal text-blue-300/50">salvando...</span>}
        </CardTitle>
        <p className="text-xs text-blue-300/50">
          Esta ordem é a rota. Confira com quem conhece a cidade: bairro no lugar errado faz o carro
          rodar mais todo dia, e isso não aparece em lugar nenhum — só na gasolina.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') adicionar();
            }}
            placeholder="Bairro que falta na lista"
            className="h-11 max-w-xs border-blue-500/20 bg-[#0c0c14] text-white placeholder:text-blue-300/30"
          />
          <Button
            onClick={adicionar}
            disabled={novo.trim() === ''}
            className="h-11 bg-blue-600 text-white hover:bg-blue-500"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
          {aviso && <span className="text-xs text-blue-300/60">{aviso}</span>}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={arrastou}>
          <SortableContext items={bairros.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {bairros.map((bairro, i) => (
                <LinhaBairro
                  key={bairro.id}
                  bairro={bairro}
                  posicao={i + 1}
                  onAlternarAtivo={onAlternarAtivo}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <p className="text-xs text-blue-300/40">
          O olho fechado desliga o bairro: ele deixa de casar na importação, mas a entrega que já
          usava ele continua valendo.
        </p>
      </CardContent>
    </Card>
  );
};

export default BairrosEntrega;

import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Trophy, Star, AlertCircle, Package, Droplets, Car, GripVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePriorityProducts, PriorityProduct } from '@/hooks/usePriorityProducts';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import SortablePriorityItem from './SortablePriorityItem';
import AdminLoadingState from './admin/AdminLoadingState';
import AdminPageHeader from './admin/AdminPageHeader';

interface PriorityProductsManagerProps {
  onEditProduct?: (productId: string) => void;
  onAddProduct?: (position: number, lineType: 'limpeza' | 'automotivo') => void;
}

const MAX_POSITIONS = 10;

const PriorityProductsManager = ({ onEditProduct, onAddProduct }: PriorityProductsManagerProps) => {
  // Fetch all priority products
  const { priorityProducts, loading, removePriority, batchUpdateOrder, refetch } = usePriorityProducts('all');
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [productToRemove, setProductToRemove] = useState<PriorityProduct | null>(null);

  // Separate products by line type
  const limpezaProducts = useMemo(() => 
    priorityProducts
      .filter(p => p.line_type === 'limpeza')
      .sort((a, b) => a.priority_order - b.priority_order),
    [priorityProducts]
  );

  const automotivoProducts = useMemo(() => 
    priorityProducts
      .filter(p => p.line_type === 'automotivo')
      .sort((a, b) => a.priority_order - b.priority_order),
    [priorityProducts]
  );

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent, lineType: 'limpeza' | 'automotivo') => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const products = lineType === 'limpeza' ? limpezaProducts : automotivoProducts;
    const oldIndex = products.findIndex(p => p.id === active.id);
    const newIndex = products.findIndex(p => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder locally
    const newProducts = arrayMove(products, oldIndex, newIndex);

    // Create batch updates with new order (1-indexed, sequential)
    const updates = newProducts.map((product, index) => ({
      id: product.id,
      order: index + 1,
    }));

    try {
      await batchUpdateOrder(updates);
      toast.success('Ordem atualizada com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar ordem');
      refetch();
    }
  };

  const handleRemovePriority = async () => {
    if (!productToRemove) return;
    
    try {
      await removePriority(productToRemove.id);
      toast.success(`"${productToRemove.name}" removido dos destaques`);
      setRemoveDialogOpen(false);
      setProductToRemove(null);
    } catch (error) {
      toast.error('Erro ao remover produto dos destaques');
    }
  };

  const confirmRemove = (product: PriorityProduct) => {
    setProductToRemove(product);
    setRemoveDialogOpen(true);
  };

  const renderProductList = (
    products: PriorityProduct[],
    lineType: 'limpeza' | 'automotivo',
    icon: React.ReactNode,
    title: string,
    emptyMessage: string
  ) => {
    const occupiedCount = products.length;

    return (
      <Card className="bg-[#12121a] border-blue-500/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              {icon}
              {title}
            </CardTitle>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-full">
              <Package className="h-4 w-4 text-blue-400" />
              <span className="text-white font-medium">{occupiedCount}</span>
              <span className="text-blue-300/60">/ {MAX_POSITIONS}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-10 w-10 text-blue-400/40 mb-3" />
              <p className="text-blue-300/60 text-sm">{emptyMessage}</p>
              {onAddProduct && (
                <button
                  onClick={() => onAddProduct(1, lineType)}
                  className="mt-3 text-sm text-blue-400 hover:text-blue-300 underline underline-offset-4"
                >
                  Adicionar primeiro produto
                </button>
              )}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleDragEnd(e, lineType)}
            >
              <SortableContext
                items={products.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {products.map((product, index) => (
                    <SortablePriorityItem
                      key={product.id}
                      product={product}
                      position={index + 1}
                      onEdit={onEditProduct}
                      onRemove={confirmRemove}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Empty slots indicator */}
          {products.length > 0 && products.length < MAX_POSITIONS && (
            <div className="mt-4 p-3 border border-dashed border-blue-500/20 rounded-lg flex items-center justify-between">
              <span className="text-sm text-blue-300/50">
                {MAX_POSITIONS - products.length} {MAX_POSITIONS - products.length === 1 ? 'posição disponível' : 'posições disponíveis'}
              </span>
              {onAddProduct && (
                <button
                  onClick={() => onAddProduct(products.length + 1, lineType)}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  + Adicionar produto
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card className="bg-[#12121a] border-blue-500/20">
        <CardContent className="py-6">
          <AdminLoadingState label="Carregando produtos prioritários..." rows={3} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminPageHeader
        icon={Star}
        title="Produtos em Destaque"
        description="Gerencie os produtos que aparecem em destaque na vitrine. Arraste para reordenar."
      />

      {/* Two columns for each line */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Limpeza Column */}
        {renderProductList(
          limpezaProducts,
          'limpeza',
          <Droplets className="h-5 w-5 text-cyan-400" />,
          'Linha Limpeza',
          'Nenhum produto de limpeza em destaque'
        )}

        {/* Automotivo Column */}
        {renderProductList(
          automotivoProducts,
          'automotivo',
          <Car className="h-5 w-5 text-blue-400" />,
          'Linha Automotivo',
          'Nenhum produto automotivo em destaque'
        )}
      </div>

      {/* Dica */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <GripVertical className="h-5 w-5 text-blue-400 mt-0.5" />
        <div>
          <p className="text-sm text-blue-300">
            <strong>Dica:</strong> Arraste os produtos pelo ícone <GripVertical className="h-4 w-4 inline mx-1" /> para reorganizar a ordem de exibição.
            As 3 primeiras posições recebem destaque especial (🥇🥈🥉).
          </p>
        </div>
      </div>

      {/* Dialog de confirmação */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent className="bg-[#12121a] border-blue-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remover dos destaques?</AlertDialogTitle>
            <AlertDialogDescription className="text-blue-300/60">
              O produto "{productToRemove?.name}" será removido da lista de destaques. 
              Ele continuará disponível na loja, mas não aparecerá mais em destaque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemovePriority}
              className="bg-red-600 hover:bg-red-500"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PriorityProductsManager;

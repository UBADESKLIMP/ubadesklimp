import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { ProductWithVariations } from '@/types/product';
import SortableAdminProductCard from './SortableAdminProductCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';

interface DraggableAdminGridProps {
  products: ProductWithVariations[];
  onReorder: (reorderedProducts: ProductWithVariations[]) => Promise<void>;
  onEdit: (product: ProductWithVariations) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (product: ProductWithVariations) => void;
}

const DraggableAdminGrid = ({ products, onReorder, onEdit, onDelete, onToggleVisibility }: DraggableAdminGridProps) => {
  const [activeProduct, setActiveProduct] = useState<ProductWithVariations | null>(null);
  const [localProducts, setLocalProducts] = useState(products);

  // Sync local products when props change
  if (products !== localProducts && !activeProduct) {
    setLocalProducts(products);
  }

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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const product = localProducts.find(p => p.id === active.id);
    setActiveProduct(product || null);
  }, [localProducts]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveProduct(null);

    if (!over || active.id === over.id) return;

    const oldIndex = localProducts.findIndex(p => p.id === active.id);
    const newIndex = localProducts.findIndex(p => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(localProducts, oldIndex, newIndex);
    
    // Update locally immediately (optimistic update)
    setLocalProducts(reordered);
    
    // Persist to database
    await onReorder(reordered);
  }, [localProducts, onReorder]);

  const formatPrice = (price: number | undefined) => {
    if (!price) return 'Preço não definido';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={localProducts.map(p => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {localProducts.map((product) => (
            <SortableAdminProductCard
              key={product.id}
              product={product}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleVisibility={onToggleVisibility}
            />
          ))}
        </div>
      </SortableContext>

      {/* Drag Overlay - Preview that follows cursor */}
      <DragOverlay adjustScale>
        {activeProduct ? (
          <Card className="bg-[#12121a]/95 border-blue-500/60 shadow-2xl shadow-blue-500/40 rotate-2 scale-105 pointer-events-none">
            <div className="relative">
              {activeProduct.image_url ? (
                <img 
                  src={activeProduct.image_url} 
                  alt={activeProduct.name}
                  className="w-full h-48 object-cover opacity-90"
                />
              ) : (
                <div className="w-full h-48 bg-blue-900/20 flex items-center justify-center">
                  <Package className="h-12 w-12 text-blue-500/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-blue-600/20 to-transparent" />
            </div>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-white">{activeProduct.name}</CardTitle>
              <p className="text-sm text-blue-300/50">{activeProduct.category}</p>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-blue-400">
                {formatPrice(activeProduct.price)}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default DraggableAdminGrid;

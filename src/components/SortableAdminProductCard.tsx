import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Edit3, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ProductWithVariations } from '@/types/product';

interface SortableAdminProductCardProps {
  product: ProductWithVariations;
  onEdit: (product: ProductWithVariations) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (product: ProductWithVariations) => void;
}

const SortableAdminProductCard = ({ product, onEdit, onDelete, onToggleVisibility }: SortableAdminProductCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return 'Preço não definido';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`
        bg-[#12121a] border-blue-500/20 hover:border-blue-500/40 
        transition-all duration-200 overflow-hidden group
        ${isDragging ? 'shadow-2xl shadow-blue-500/30 scale-[1.02] border-blue-500/60' : ''}
      `}
    >
      {/* Drag Handle - Top bar */}
      <div
        {...attributes}
        {...listeners}
        className={`
          flex items-center justify-center gap-2 py-2 px-3
          cursor-grab active:cursor-grabbing
          bg-blue-500/5 hover:bg-blue-500/10 transition-colors
          border-b border-blue-500/10
        `}
      >
        <GripVertical className="h-4 w-4 text-blue-400/60" />
        <span className="text-xs text-blue-300/50">Arraste para reorganizar</span>
      </div>

      <div className="relative">
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-blue-900/20 flex items-center justify-center">
            <Package className="h-12 w-12 text-blue-500/40" />
          </div>
        )}
        <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => onEdit(product)}
            className="bg-blue-600/80 hover:bg-blue-500 text-white border-0 backdrop-blur-sm"
          >
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => onDelete(product.id)}
            className="bg-red-600/80 hover:bg-red-500 text-white border-0 backdrop-blur-sm"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div>
            <CardTitle className="text-lg text-white">{product.name}</CardTitle>
            <p className="text-sm text-blue-300/50">{product.category}</p>
          </div>
          <label
            className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[10px] uppercase tracking-wide text-blue-300/50">Público</span>
            <Switch
              checked={product.is_public ?? true}
              onCheckedChange={() => onToggleVisibility(product)}
            />
          </label>
        </div>
      </CardHeader>
      <CardContent>
        {product.description && (
          <p className="text-sm text-blue-300/50 mb-3 line-clamp-2">
            {product.description}
          </p>
        )}
        <p className="text-lg font-bold text-blue-400">
          {formatPrice(product.price)}
        </p>
      </CardContent>
    </Card>
  );
};

export default SortableAdminProductCard;

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trophy, Medal, Star, Edit3, Trash2, Package, Sparkles, Target, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PriorityProduct } from '@/hooks/usePriorityProducts';

interface SortablePriorityItemProps {
  product: PriorityProduct;
  position: number;
  onEdit?: (productId: string) => void;
  onRemove: (product: PriorityProduct) => void;
}

const getPositionIcon = (position: number) => {
  switch (position) {
    case 1:
      return <Trophy className="h-5 w-5 text-yellow-400" />;
    case 2:
      return <Medal className="h-5 w-5 text-slate-300" />;
    case 3:
      return <Medal className="h-5 w-5 text-amber-600" />;
    default:
      return <Star className="h-4 w-4 text-blue-400" />;
  }
};

const getPositionLabel = (position: number) => {
  switch (position) {
    case 1:
      return '🥇 1º';
    case 2:
      return '🥈 2º';
    case 3:
      return '🥉 3º';
    default:
      return `${position}º`;
  }
};

const getHighlightBadge = (type: string | null) => {
  switch (type) {
    case 'bestseller':
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Trophy className="h-3 w-3 mr-1" /> Mais Vendido</Badge>;
    case 'promotion':
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><Target className="h-3 w-3 mr-1" /> Promoção</Badge>;
    case 'new':
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><Sparkles className="h-3 w-3 mr-1" /> Novidade</Badge>;
    case 'featured':
      return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30"><Award className="h-3 w-3 mr-1" /> Destaque</Badge>;
    default:
      return null;
  }
};

const SortablePriorityItem = ({ product, position, onEdit, onRemove }: SortablePriorityItemProps) => {
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
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`
        transition-all duration-200
        bg-[#12121a] border-blue-500/30 hover:border-blue-500/50
        ${position <= 3 ? 'ring-1 ring-yellow-500/10' : ''}
        ${isDragging ? 'shadow-xl shadow-blue-500/20 opacity-90 scale-[1.02]' : ''}
      `}
    >
      <CardContent className="flex items-center gap-4 p-4">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-blue-500/10 rounded transition-colors"
        >
          <GripVertical className="h-5 w-5 text-blue-400/60" />
        </div>

        {/* Posição */}
        <div className={`
          flex items-center justify-center w-10 h-10 rounded-xl shrink-0
          ${position <= 3 
            ? 'bg-gradient-to-br from-yellow-500/20 to-amber-600/20' 
            : 'bg-blue-500/10'
          }
        `}>
          {getPositionIcon(position)}
        </div>

        {/* Imagem do produto */}
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name}
            className="w-12 h-12 object-contain rounded-lg bg-white/5 shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-blue-400" />
          </div>
        )}

        {/* Info do produto */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white truncate">
              {product.name}
            </span>
            {getHighlightBadge(product.highlight_type)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-300">
              {product.category}
            </Badge>
            <span className="text-xs text-blue-300/60">
              R$ {product.price?.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Label da posição */}
        <div className={`
          text-sm font-medium px-3 py-1 rounded-full shrink-0
          ${position <= 3 
            ? 'bg-yellow-500/10 text-yellow-400' 
            : 'bg-blue-500/10 text-blue-400'
          }
        `}>
          {getPositionLabel(position)}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(product.id)}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(product)}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SortablePriorityItem;

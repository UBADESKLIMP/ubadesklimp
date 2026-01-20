import { useEffect } from 'react';
import { Trophy, Medal, Star, AlertCircle, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { usePriorityProducts } from '@/hooks/usePriorityProducts';

interface PriorityPositionSelectProps {
  value: string;
  onChange: (value: string) => void;
  currentProductId?: string;
  lineType?: 'limpeza' | 'automotivo';
}

const MAX_POSITIONS = 10;

const PriorityPositionSelect = ({ 
  value, 
  onChange, 
  currentProductId,
  lineType 
}: PriorityPositionSelectProps) => {
  // Filter by line type to show only positions within that line
  const { priorityProducts, loading, getPositionStatus, getNextAvailablePosition } = usePriorityProducts(lineType || 'all');

  // Auto-set to next available position when first enabling priority
  useEffect(() => {
    if (value === '0' || value === '') {
      const nextPos = getNextAvailablePosition(lineType);
      onChange(nextPos.toString());
    }
  }, [value, lineType, getNextAvailablePosition, onChange]);

  const positions = Array.from({ length: MAX_POSITIONS }, (_, i) => i + 1);

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="h-4 w-4 text-yellow-400" />;
      case 2:
        return <Medal className="h-4 w-4 text-slate-300" />;
      case 3:
        return <Medal className="h-4 w-4 text-amber-600" />;
      default:
        return <Star className="h-3 w-3 text-blue-400" />;
    }
  };

  const getPositionLabel = (position: number) => {
    switch (position) {
      case 1:
        return '1º';
      case 2:
        return '2º';
      case 3:
        return '3º';
      default:
        return `${position}º`;
    }
  };

  // Filter products by line type for display
  const filteredProducts = lineType 
    ? priorityProducts.filter(p => p.line_type === lineType)
    : priorityProducts;

  const renderPositionOption = (position: number) => {
    // Check if this position is occupied within the same line type
    const occupyingProduct = filteredProducts.find(
      p => p.priority_order === position && p.id !== currentProductId
    );
    const isOccupied = !!occupyingProduct;

    return (
      <SelectItem 
        key={position} 
        value={position.toString()}
        className="py-3"
      >
        <div className="flex items-center gap-3 w-full">
          {/* Ícone da posição */}
          <div className={`
            flex items-center justify-center w-8 h-8 rounded-lg
            ${position <= 3 
              ? 'bg-gradient-to-br from-yellow-500/20 to-amber-600/20' 
              : 'bg-blue-500/10'
            }
          `}>
            {getPositionIcon(position)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-medium ${position <= 3 ? 'text-yellow-400' : 'text-white'}`}>
                {getPositionLabel(position)} lugar
              </span>
              
              {isOccupied ? (
                <span className="flex items-center gap-1 text-xs text-orange-400">
                  <AlertCircle className="h-3 w-3" />
                  Ocupada
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle className="h-3 w-3" />
                  Livre
                </span>
              )}
            </div>

            {isOccupied && occupyingProduct && (
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                ⚠️ {occupyingProduct.name.slice(0, 30)}{occupyingProduct.name.length > 30 ? '...' : ''}
              </div>
            )}
          </div>
        </div>
      </SelectItem>
    );
  };

  // Mostrar resumo das posições ocupadas
  const occupiedPositions = filteredProducts
    .filter(p => p.id !== currentProductId)
    .slice(0, 5);

  return (
    <div className="space-y-3">
      <Label htmlFor="priority_order">Posição no Destaque</Label>
      
      <Select value={value} onValueChange={onChange} disabled={loading}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={loading ? "Carregando..." : "Escolha a posição"} />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {positions.map(renderPositionOption)}
        </SelectContent>
      </Select>

      {/* Mini resumo das posições ocupadas */}
      {occupiedPositions.length > 0 && (
        <div className="p-3 bg-muted/30 rounded-lg border">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            📊 Posições ocupadas {lineType ? `(${lineType === 'automotivo' ? 'Automotivo' : 'Limpeza'})` : ''}:
          </p>
          <div className="space-y-1">
            {occupiedPositions.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                {getPositionIcon(p.priority_order)}
                <span className="text-muted-foreground">
                  {p.priority_order}º -
                </span>
                <span className="text-foreground truncate">
                  {p.name}
                </span>
              </div>
            ))}
            {filteredProducts.filter(p => p.id !== currentProductId).length > 5 && (
              <p className="text-xs text-muted-foreground italic">
                + {filteredProducts.filter(p => p.id !== currentProductId).length - 5} outros...
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        💡 Novos produtos são adicionados ao final da lista. Você pode reordenar na aba "Destaques".
      </p>
    </div>
  );
};

export default PriorityPositionSelect;

import { useState } from 'react';
import { Trophy, Medal, Star, Edit3, Trash2, Plus, AlertCircle, Package, Sparkles, Target, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface PriorityProductsManagerProps {
  onEditProduct?: (productId: string) => void;
  onAddProduct?: (position: number) => void;
}

const MAX_POSITIONS = 10;

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
      return '🥇 1º lugar';
    case 2:
      return '🥈 2º lugar';
    case 3:
      return '🥉 3º lugar';
    default:
      return `⭐ ${position}º lugar`;
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

const PriorityProductsManager = ({ onEditProduct, onAddProduct }: PriorityProductsManagerProps) => {
  const [lineFilter, setLineFilter] = useState<'all' | 'limpeza' | 'automotivo'>('all');
  const { priorityProducts, loading, removePriority, refetch } = usePriorityProducts(lineFilter);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [productToRemove, setProductToRemove] = useState<PriorityProduct | null>(null);

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

  // Criar array com todas as 10 posições
  const positions = Array.from({ length: MAX_POSITIONS }, (_, i) => i + 1);
  const occupiedCount = priorityProducts.length;

  if (loading) {
    return (
      <Card className="bg-[#12121a] border-blue-500/20">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-blue-300/60">Carregando produtos prioritários...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-white flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-400" />
            Produtos em Destaque
          </h2>
          <p className="text-blue-300/60 mt-1">
            Gerencie os produtos que aparecem em destaque na vitrine
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Filtro por linha */}
          <Tabs value={lineFilter} onValueChange={(v) => setLineFilter(v as any)}>
            <TabsList className="bg-[#12121a] border border-blue-500/20">
              <TabsTrigger value="all" className="data-[state=active]:bg-blue-600/30">
                Todos
              </TabsTrigger>
              <TabsTrigger value="limpeza" className="data-[state=active]:bg-blue-600/30">
                Limpeza
              </TabsTrigger>
              <TabsTrigger value="automotivo" className="data-[state=active]:bg-blue-600/30">
                Automotivo
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Estatísticas */}
          <div className="flex items-center gap-2 px-4 py-2 bg-[#12121a] border border-blue-500/20 rounded-lg">
            <Package className="h-4 w-4 text-blue-400" />
            <span className="text-white font-medium">{occupiedCount}</span>
            <span className="text-blue-300/60">/ {MAX_POSITIONS}</span>
          </div>
        </div>
      </div>

      {/* Grid de posições */}
      <div className="grid gap-3">
        {positions.map((position) => {
          const product = priorityProducts.find(p => p.priority_order === position);
          const isOccupied = !!product;

          return (
            <Card 
              key={position}
              className={`
                transition-all duration-200
                ${isOccupied 
                  ? 'bg-[#12121a] border-blue-500/30 hover:border-blue-500/50' 
                  : 'bg-[#0a0a0f] border-dashed border-blue-500/20 hover:border-blue-500/30'
                }
                ${position <= 3 ? 'ring-1 ring-yellow-500/10' : ''}
              `}
            >
              <CardContent className="flex items-center gap-4 p-4">
                {/* Posição */}
                <div className={`
                  flex items-center justify-center w-12 h-12 rounded-xl
                  ${position <= 3 
                    ? 'bg-gradient-to-br from-yellow-500/20 to-amber-600/20' 
                    : 'bg-blue-500/10'
                  }
                `}>
                  {getPositionIcon(position)}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  {isOccupied ? (
                    <div className="flex items-center gap-3">
                      {/* Imagem do produto */}
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-12 h-12 object-contain rounded-lg bg-white/5"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
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
                          <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-300">
                            {product.line_type === 'automotivo' ? '🚗 Auto' : '🧹 Limpeza'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-blue-300/40">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">Posição disponível</span>
                    </div>
                  )}
                </div>

                {/* Label da posição */}
                <div className={`
                  text-sm font-medium px-3 py-1 rounded-full
                  ${position <= 3 
                    ? 'bg-yellow-500/10 text-yellow-400' 
                    : 'bg-blue-500/10 text-blue-400'
                  }
                `}>
                  {getPositionLabel(position)}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2">
                  {isOccupied ? (
                    <>
                      {onEditProduct && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditProduct(product.id)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => confirmRemove(product)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    onAddProduct && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAddProduct(position)}
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dica */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
        <div>
          <p className="text-sm text-blue-300">
            <strong>Dica:</strong> Os produtos prioritários aparecem em destaque na página inicial. 
            As 3 primeiras posições recebem destaque especial (medalhas de ouro, prata e bronze).
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

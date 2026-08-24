import { Edit3, Trash2, Package, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ProductWithVariations } from '@/types/product';

interface NonPublicProductsSectionProps {
  products: ProductWithVariations[];
  onEdit: (product: ProductWithVariations) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (product: ProductWithVariations) => void;
}

const formatPrice = (price: number | undefined) => {
  if (!price) return 'Preço não definido';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
};

// Produtos comprados/controlados internamente mas que não devem aparecer na
// vitrine (ex: itens só de área física). Sem drag-and-drop — a ordem de
// exibição só importa pra quem está no site.
const NonPublicProductsSection = ({ products, onEdit, onDelete, onToggleVisibility }: NonPublicProductsSectionProps) => {
  if (products.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <EyeOff className="h-4 w-4 text-blue-300/50" />
        <h3 className="text-sm font-semibold text-blue-300/70 uppercase tracking-wide">
          Produtos não públicos
        </h3>
        <span className="text-xs text-blue-300/40">({products.length}) — não aparecem no site</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <Card
            key={product.id}
            className="bg-[#12121a] border-blue-500/10 opacity-80 hover:opacity-100 transition-opacity overflow-hidden group"
          >
            <div className="relative">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-40 object-cover grayscale-[30%]" />
              ) : (
                <div className="w-full h-40 bg-blue-900/10 flex items-center justify-center">
                  <Package className="h-10 w-10 text-blue-500/30" />
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
                  <CardTitle className="text-base text-white">{product.name}</CardTitle>
                  <p className="text-sm text-blue-300/50">{product.category}</p>
                </div>
                <label className="flex flex-col items-center gap-1 shrink-0 cursor-pointer">
                  <span className="text-[10px] uppercase tracking-wide text-blue-300/50">Público</span>
                  <Switch checked={false} onCheckedChange={() => onToggleVisibility(product)} />
                </label>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-base font-bold text-blue-400">{formatPrice(product.price)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default NonPublicProductsSection;

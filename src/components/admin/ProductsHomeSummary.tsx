import { useMemo } from 'react';
import { Package, AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProducts } from '@/hooks/useProducts';
import AdminStatCard from './AdminStatCard';
import { AdminSection } from './adminNav';

interface ProductsHomeSummaryProps {
  onNavigate: (section: AdminSection) => void;
}

const ProductsHomeSummary = ({ onNavigate }: ProductsHomeSummaryProps) => {
  const { products, loading } = useProducts({ includeNonPublic: true });

  const incompleteCount = useMemo(
    () => products.filter((product) => !product.image_url || !product.description).length,
    [products]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-heading text-white">Produtos</h3>
        <Button
          size="sm"
          onClick={() => onNavigate('products')}
          className="bg-blue-600 hover:bg-blue-500 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Novo produto
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AdminStatCard
          icon={Package}
          label="Produtos ativos"
          value={loading ? '...' : products.length}
        />
        <AdminStatCard
          icon={AlertTriangle}
          label="Incompletos"
          value={loading ? '...' : incompleteCount}
          hint="Sem imagem ou sem descrição"
        />
      </div>
    </div>
  );
};

export default ProductsHomeSummary;

import { Search, Filter } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useProducts } from '@/hooks/useProducts';
import { useImagePreload } from '@/hooks/useImagePreload';
import { ProductWithVariations } from '@/types/product';
import ProductCard from './ProductCard';
import { normalizeText } from '@/lib/utils';

const Products = () => {
  const { products, loading } = useProducts();
  
  // Filtrar apenas produtos de LIMPEZA (não automotivos)
  const limpezaProducts = products.filter(p => (p.line_type ?? 'limpeza') === 'limpeza');
  
  // Preload das imagens prioritárias
  useImagePreload(limpezaProducts, 8);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Get unique categories from limpeza products only
  const categories = Array.from(new Set(limpezaProducts.map(product => product.category))).sort();

  // Filter products based on search and category (ignoring accents)
  const filteredProducts = limpezaProducts.filter(product => {
    const normalizedSearch = normalizeText(searchTerm);
    const matchesSearch = normalizeText(product.name).includes(normalizedSearch) ||
                         (normalizeText(product.description || '').includes(normalizedSearch));
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
  };

  const handleShowDetails = (product: ProductWithVariations) => {
    navigate(`/produto/${product.slug}`);
  };

  if (loading) {
    return (
      <section id="products" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-heading text-foreground mb-4">
              Nossos <span className="text-gradient">Produtos</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Carregando nossos produtos...
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className="bg-card rounded-2xl border border-border/50 overflow-hidden animate-fade-in"
                style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}
              >
                {/* Image skeleton with shimmer */}
                <div className="relative h-52 bg-muted overflow-hidden">
                  <Skeleton className="absolute inset-0 rounded-none" />
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    style={{ 
                      animation: 'shimmer 1.5s infinite',
                      transform: 'translateX(-100%)'
                    }}
                  />
                </div>
                {/* Content skeleton */}
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-4/5 rounded-md" />
                  <Skeleton className="h-4 w-3/5 rounded-md" />
                  <div className="flex items-center justify-between pt-2">
                    <Skeleton className="h-6 w-24 rounded-md" />
                    <Skeleton className="h-9 w-9 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="products" className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-5xl font-heading text-foreground mb-4">
            Nossos <span className="text-gradient">Produtos</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Selecionamos os melhores produtos de limpeza para garantir resultados excepcionais
          </p>
        </div>

        {/* Search and Filter Section */}
        {limpezaProducts.length > 0 && (
          <div className="mb-12 animate-fade-in">
            <div className="bg-gradient-card rounded-2xl p-6 shadow-soft border border-border">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                {/* Search Input */}
                <div className="relative flex-1 w-full md:w-auto">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Pesquisar produtos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-background border-border focus:ring-primary"
                  />
                </div>

                {/* Category Filter */}
                <div className="w-full md:w-64">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="bg-background border-border">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Todas as categorias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear Filters */}
                {(searchTerm || selectedCategory !== 'all') && (
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="w-full md:w-auto"
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>

              {/* Results Counter */}
              <div className="mt-4 text-sm text-muted-foreground">
                {filteredProducts.length === limpezaProducts.length
                  ? `${limpezaProducts.length} produtos encontrados`
                  : `${filteredProducts.length} de ${limpezaProducts.length} produtos`}
              </div>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onShowDetails={handleShowDetails}
              />
            ))}
          </div>
        ) : limpezaProducts.length > 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2">Nenhum produto encontrado</h3>
            <p className="text-muted-foreground mb-6">
              Tente ajustar seus filtros de pesquisa
            </p>
            <Button onClick={clearFilters} className="btn-secondary">
              Limpar filtros
            </Button>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-xl font-semibold mb-2">Em breve novos produtos</h3>
            <p className="text-muted-foreground">
              Estamos preparando produtos incríveis para você!
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default Products;

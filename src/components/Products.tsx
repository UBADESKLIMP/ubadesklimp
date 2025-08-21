
import { ShoppingCart, Search, Filter } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCart } from '@/contexts/CartContext';
import { toast } from '@/hooks/use-toast';
import { useProducts } from '@/hooks/useProducts';

const Products = () => {
  const { addToCart } = useCart();
  const { products, loading } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Get unique categories from products
  const categories = Array.from(new Set(products.map(product => product.category))).sort();

  // Filter products based on search and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddToCart = (product: any) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(product.price),
      category: product.category,
    });
    
    toast({
      title: "Produto adicionado!",
      description: `${product.name} foi adicionado ao carrinho.`,
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="bg-gradient-card border-border animate-pulse">
                <div className="p-6">
                  <div className="w-full h-48 bg-muted rounded mb-4"></div>
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-6 bg-muted rounded mb-4"></div>
                  <div className="h-4 bg-muted rounded mb-4"></div>
                  <div className="flex justify-between items-center">
                    <div className="h-6 w-20 bg-muted rounded"></div>
                    <div className="h-10 w-24 bg-muted rounded"></div>
                  </div>
                </div>
              </Card>
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
        {products.length > 0 && (
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
                {filteredProducts.length === products.length
                  ? `${products.length} produtos encontrados`
                  : `${filteredProducts.length} de ${products.length} produtos`}
              </div>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => (
              <Card 
                key={product.id} 
                className="bg-gradient-card border-border hover-lift group animate-slide-up overflow-hidden"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="p-0">
                  {/* Product Image - Adjusted size like the reference */}
                  <div className="relative h-48 w-full overflow-hidden bg-muted/50 flex items-center justify-center p-4">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-muted to-muted/50">
                        📦
                      </div>
                    )}
                    
                    {/* Category Badge */}
                    <div className="absolute top-2 right-2">
                      <div className="inline-block px-2 py-1 bg-primary/90 backdrop-blur-sm text-primary-foreground text-xs font-medium rounded-full shadow-medium">
                        {product.category}
                      </div>
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-heading text-foreground mb-2 line-clamp-2">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="text-muted-foreground mb-3 text-sm line-clamp-2">
                        {product.description}
                      </p>
                    )}

                    {/* Price and CTA */}
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-foreground">
                        {formatPrice(product.price)}
                      </span>
                      <Button 
                        size="sm"
                        className="btn-secondary"
                        onClick={() => handleAddToCart(product)}
                      >
                        <ShoppingCart className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : products.length > 0 ? (
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

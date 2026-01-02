import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Car, Search, X } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import ProductDetailModal from '@/components/ProductDetailModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useProducts } from '@/hooks/useProducts';
import { ProductWithVariations } from '@/types/product';

const Automotivo = () => {
  const { products, loading } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductWithVariations | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter only automotive products
  const automotiveProducts = products.filter(
    product => product.category?.toLowerCase() === 'automotivo'
  );

  // Apply search filter
  const filteredProducts = automotiveProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleShowDetails = (product: ProductWithVariations) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-14 md:pt-16">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 py-16 md:py-24 overflow-hidden">
          {/* Background decorations */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(59,130,246,0.2),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(59,130,246,0.15),transparent_40%)]" />
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
          
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }} />

          <div className="relative max-w-7xl mx-auto px-4 md:px-8">
            <Link to="/">
              <Button variant="ghost" className="text-blue-300 hover:text-white hover:bg-blue-500/20 mb-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Início
              </Button>
            </Link>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="p-4 rounded-xl bg-blue-500/20 border border-blue-500/30">
                <Car className="h-10 w-10 text-blue-400" />
              </div>
              <span className="text-blue-400 text-sm font-semibold uppercase tracking-wider">
                Catálogo Exclusivo
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
              Linha Automotiva
              <span className="block text-blue-400">Profissional</span>
            </h1>
            
            <p className="text-slate-300 text-lg md:text-xl max-w-2xl mb-8">
              Produtos especializados de alta qualidade para o cuidado completo do seu veículo. 
              Limpeza, proteção e brilho profissional.
            </p>

            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar produtos automotivos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-10 py-6 bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Products Section */}
        <section className="py-12 md:py-16 px-4 md:px-8">
          <div className="max-w-7xl mx-auto">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-4">
                    <Skeleton className="h-48 w-full rounded-xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-8">
                  <p className="text-muted-foreground">
                    {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onShowDetails={() => handleShowDetails(product)}
                    />
                  ))}
                </div>
              </>
            ) : automotiveProducts.length === 0 ? (
              <div className="text-center py-16">
                <div className="p-6 rounded-full bg-blue-500/10 w-fit mx-auto mb-6">
                  <Car className="h-12 w-12 text-blue-400" />
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-2">
                  Em breve
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Estamos preparando nossa linha automotiva profissional. Volte em breve para conferir nossos produtos!
                </p>
                <Link to="/">
                  <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar ao Início
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground mb-4">
                  Nenhum produto encontrado para "{searchTerm}"
                </p>
                <Button variant="outline" onClick={() => setSearchTerm('')}>
                  Limpar busca
                </Button>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />

      <ProductDetailModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default Automotivo;

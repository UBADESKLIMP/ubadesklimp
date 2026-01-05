import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Car, Search, X } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import ProductDetailModal from '@/components/ProductDetailModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useProducts } from '@/hooks/useProducts';
import { ProductWithVariations } from '@/types/product';
import carHeroImage from '@/assets/carro-automotivo-hero.png';
import carNeonLogo from '@/assets/teste_carro_gpt_2.0.png';

const Automotivo = () => {
  const { products, loading } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductWithVariations | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
        {/* Hero Section - Premium Layout */}
        <section className="relative bg-[#0a0a0f] min-h-[500px] md:min-h-[600px] overflow-hidden">
          {/* Showroom Floor - Two Realistic Light Lines */}
          
          {/* Front light line (closer to viewer - aligned with front wheels) */}
          <div 
            className="absolute bottom-[22%] left-1/2 -translate-x-1/2 w-[90%] h-[2px] pointer-events-none"
            style={{ 
              background: 'linear-gradient(90deg, transparent 5%, rgba(120,180,255,0.15) 20%, rgba(150,200,255,0.5) 40%, rgba(180,220,255,0.8) 50%, rgba(150,200,255,0.5) 60%, rgba(120,180,255,0.15) 80%, transparent 95%)',
              boxShadow: '0 0 20px 3px rgba(100,160,255,0.4), 0 0 40px 8px rgba(80,140,255,0.2), 0 0 60px 12px rgba(60,120,255,0.1)'
            }}
          />
          {/* Front line glow spread */}
          <div 
            className="absolute bottom-[22%] left-1/2 -translate-x-1/2 w-[85%] h-16 blur-xl pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(100,160,255,0.15), rgba(120,180,255,0.25), rgba(100,160,255,0.15), transparent)' }}
          />
          
          {/* Back light line (aligned with rear wheels) */}
          <div 
            className="absolute bottom-[28%] left-1/2 -translate-x-1/2 w-[75%] h-[1.5px] pointer-events-none"
            style={{ 
              background: 'linear-gradient(90deg, transparent 10%, rgba(100,160,255,0.1) 25%, rgba(130,190,255,0.35) 45%, rgba(160,210,255,0.5) 50%, rgba(130,190,255,0.35) 55%, rgba(100,160,255,0.1) 75%, transparent 90%)',
              boxShadow: '0 0 15px 2px rgba(100,160,255,0.25), 0 0 30px 5px rgba(80,140,255,0.12)'
            }}
          />
          {/* Back line glow spread */}
          <div 
            className="absolute bottom-[28%] left-1/2 -translate-x-1/2 w-[70%] h-12 blur-xl pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(100,160,255,0.08), rgba(120,180,255,0.15), rgba(100,160,255,0.08), transparent)' }}
          />
          
          {/* Floor ambient reflection between lines */}
          <div 
            className="absolute bottom-[22%] left-1/2 -translate-x-1/2 w-[80%] h-[8%] blur-2xl pointer-events-none opacity-60"
            style={{ background: 'radial-gradient(ellipse 100% 50% at center, rgba(80,140,220,0.2), transparent 70%)' }}
          />
          
          {/* Subtle ambient gradients - Premium blue showroom */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(59,130,246,0.04),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_30%,rgba(59,130,246,0.03),transparent_40%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(59,130,246,0.08),transparent_50%)]" />

          <div className="relative max-w-7xl mx-auto px-4 md:px-8 h-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-center min-h-[500px] md:min-h-[600px]">
              
              {/* Left Side - Content */}
              <div className="py-12 md:py-16 order-2 lg:order-1 text-center lg:text-left">
                {/* Logo UbadeskCar - With neon car and glow */}
                <div className="flex items-center gap-4 mb-8 justify-center lg:justify-start">
                  <img 
                    src={carNeonLogo} 
                    alt="UbadeskCar" 
                    className="h-28 md:h-32 lg:h-36 w-auto"
                  />
                  <span className="text-3xl md:text-4xl font-bold">
                    <span className="text-white">Ubadesk</span>
                    <span className="text-blue-500">Car</span>
                  </span>
                </div>
                
                {/* Title */}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2 leading-tight">
                  Linha Automotiva
                </h1>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-blue-500 mb-6">
                  Profissional
                </h2>
                
                {/* Description */}
                <p className="text-gray-400 text-lg md:text-xl max-w-md mb-8 mx-auto lg:mx-0">
                  Limpeza, proteção e brilho para quem exige padrão profissional.
                </p>
                
                {/* CTA Button */}
                <Button 
                  onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg font-semibold rounded-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(30,144,255,0.4)]"
                >
                  <Car className="mr-2 h-5 w-5" />
                  Ver produtos
                </Button>
              </div>
              
              {/* Right Side - Car with Parallax */}
              <div className="relative order-1 lg:order-2 flex items-end justify-center lg:justify-end">
                {/* Car Image with Parallax */}
                <div 
                  className="relative w-full max-w-lg lg:max-w-none transition-transform duration-100"
                  style={{ transform: `translateY(${scrollY * 0.15}px)` }}
                >
                  <img 
                    src={carHeroImage} 
                    alt="Linha Automotiva Profissional" 
                    className="w-full h-auto object-contain drop-shadow-2xl"
                  />
                  
                  {/* Car Reflection - Subtle showroom floor */}
                  <div className="absolute top-full left-0 w-full h-32 overflow-hidden pointer-events-none">
                    <img 
                      src={carHeroImage} 
                      alt="" 
                      className="w-full h-auto opacity-15"
                      style={{ 
                        transform: 'scaleY(-1)',
                        filter: 'blur(2px)',
                        maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)',
                        WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)'
                      }}
                    />
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </section>

        {/* Products Section */}
        <section id="products" className="py-12 md:py-16 px-4 md:px-8 bg-background">
          <div className="max-w-7xl mx-auto">
            {/* Search Bar */}
            <div className="relative max-w-md mb-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar produtos automotivos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-10 py-6"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

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
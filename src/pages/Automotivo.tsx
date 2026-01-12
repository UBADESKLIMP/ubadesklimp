import { useState, useEffect, useRef, useMemo } from 'react';
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
import { useImagePreload } from '@/hooks/useImagePreload';
import { ProductWithVariations } from '@/types/product';
import carHeroImage from '@/assets/carro-automotivo-hero.png';
import carNeonLogo from '@/assets/teste_carro_gpt_2.0.png';

const Automotivo = () => {
  const { products, loading } = useProducts();
  
  // Preload das imagens prioritárias (produtos automotivos)
  const automotiveProductsForPreload = products.filter(
    p => p.category?.toLowerCase() === 'automotivo'
  );
  useImagePreload(automotiveProductsForPreload, 8);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductWithVariations | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [parallaxY, setParallaxY] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const parallaxRef = useRef(0);
  const targetParallax = useRef(0);

  // Generate floating particles
  const particles = useMemo(() => 
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      size: Math.random() * 2.5 + 1,
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 6 + Math.random() * 5,
      opacity: 0.15 + Math.random() * 0.25
    })), 
  []);

  // Animation trigger on load
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Smooth parallax with optimized lerp - more responsive and limited range
  useEffect(() => {
    let animationId: number;
    let lastTime = 0;
    const maxParallax = 60; // Limit max movement to stay within light trails
    
    const handleScroll = () => {
      // Clamp parallax to prevent car from leaving light trails
      targetParallax.current = Math.min(window.scrollY * 0.08, maxParallax);
    };
    
    const animate = (currentTime: number) => {
      // Throttle to ~60fps for consistent timing
      if (currentTime - lastTime >= 16) {
        // Higher lerp factor (0.15) for snappier response
        const delta = targetParallax.current - parallaxRef.current;
        parallaxRef.current += delta * 0.15;
        
        // Only update state if change is significant (reduces re-renders)
        if (Math.abs(delta) > 0.1) {
          setParallaxY(parallaxRef.current);
        }
        lastTime = currentTime;
      }
      animationId = requestAnimationFrame(animate);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    animationId = requestAnimationFrame(animate);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationId);
    };
  }, []);

  // Filter only automotive products (by line_type or category fallback)
  const automotiveProducts = products.filter(
    product => product.line_type === 'automotivo' || product.category?.toLowerCase() === 'automotivo'
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
    <div className={`min-h-screen bg-background transition-opacity duration-700 ease-out ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      <Header />
      
      <main className="pt-14 md:pt-16">
        {/* Hero Section - Premium Layout */}
        <section className="relative bg-[#0a0a0f] min-h-[420px] sm:min-h-[480px] md:min-h-[550px] lg:min-h-[600px] overflow-hidden">
          {/* Showroom Floor - Light lines - Desktop only */}
          
          {/* Front light line - desktop */}
          <div 
            className="hidden md:block absolute bottom-[32%] left-1/2 -translate-x-1/2 w-[55%] h-[1px] pointer-events-none animate-[lightPulse_4s_ease-in-out_infinite]"
            style={{ 
              background: 'linear-gradient(90deg, transparent 5%, rgba(140,180,255,0.25) 30%, rgba(180,210,255,0.35) 50%, rgba(140,180,255,0.25) 70%, transparent 95%)',
              boxShadow: '0 0 8px 1px rgba(100,160,255,0.12)'
            }}
          />
          {/* Front line subtle glow - desktop */}
          <div 
            className="hidden md:block absolute bottom-[32%] left-1/2 -translate-x-1/2 w-[50%] h-6 blur-xl pointer-events-none animate-[lightPulse_4s_ease-in-out_infinite]"
            style={{ background: 'linear-gradient(to top, rgba(100,160,255,0.06), transparent)' }}
          />
          
          {/* Back light line - desktop */}
          <div 
            className="hidden md:block absolute bottom-[42%] left-1/2 -translate-x-1/2 w-[45%] h-[1px] pointer-events-none animate-[lightPulse_4s_ease-in-out_infinite_2s]"
            style={{ 
              background: 'linear-gradient(90deg, transparent 10%, rgba(140,180,255,0.18) 35%, rgba(160,200,255,0.28) 50%, rgba(140,180,255,0.18) 65%, transparent 90%)',
              boxShadow: '0 0 6px 1px rgba(100,160,255,0.08)'
            }}
          />
          
          {/* Floor ambient reflection - desktop */}
          <div 
            className="hidden md:block absolute bottom-[28%] left-1/2 -translate-x-1/2 w-[50%] h-[10%] blur-2xl pointer-events-none animate-[lightPulse_5s_ease-in-out_infinite_1s]"
            style={{ background: 'radial-gradient(ellipse 100% 80% at center, rgba(80,140,220,0.06), transparent 70%)' }}
          />
          
          {/* MOBILE-ONLY Light Lines - aligned with the car angle + infinite width */}
          <div 
            className="md:hidden absolute bottom-[55%] left-1/2 w-[220vw] h-[2px] pointer-events-none animate-[lightPulse_4s_ease-in-out_infinite]"
            style={{ 
              background: 'linear-gradient(90deg, transparent 5%, rgba(140,180,255,0.35) 30%, rgba(180,210,255,0.5) 50%, rgba(140,180,255,0.35) 70%, transparent 95%)',
              boxShadow: '0 0 8px 2px rgba(100,160,255,0.2)',
              transform: 'translateX(-50%) rotate(-1deg)'
            }}
          />
          <div 
            className="md:hidden absolute bottom-[55%] left-1/2 w-[200vw] h-6 blur-lg pointer-events-none"
            style={{ 
              background: 'linear-gradient(to top, rgba(100,160,255,0.12), transparent)',
              transform: 'translateX(-50%) rotate(-1deg)'
            }}
          />
          <div 
            className="md:hidden absolute bottom-[61%] left-1/2 w-[210vw] h-[1px] pointer-events-none animate-[lightPulse_4s_ease-in-out_infinite_2s]"
            style={{ 
              background: 'linear-gradient(90deg, transparent 10%, rgba(140,180,255,0.25) 35%, rgba(160,200,255,0.35) 50%, rgba(140,180,255,0.25) 65%, transparent 90%)',
              boxShadow: '0 0 6px 1px rgba(100,160,255,0.12)',
              transform: 'translateX(-50%) rotate(-1deg)'
            }}
          />
          {/* Mobile floor reflection - below the car */}
          <div 
            className="md:hidden absolute bottom-[49%] left-1/2 -translate-x-1/2 w-[240vw] h-[8%] blur-xl pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 100% 80% at center, rgba(80,140,220,0.15), transparent 70%)' }}
          />
          {/* Mobile dust particles - around the car */}
          <div className="md:hidden absolute inset-x-0 bottom-[51%] h-[15%] overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div
                key={`mobile-particle-${i}`}
                className="absolute rounded-full"
                style={{
                  width: 2 + Math.random() * 2,
                  height: 2 + Math.random() * 2,
                  left: `${15 + i * 14}%`,
                  bottom: `${30 + (i % 3) * 25}%`,
                  background: 'rgba(140,180,255,0.5)',
                  boxShadow: '0 0 4px rgba(140,180,255,0.4)',
                  animation: `floatParticle ${5 + i * 0.5}s ease-in-out infinite`,
                  animationDelay: `${i * 0.8}s`,
                }}
              />
            ))}
          </div>
          
          {/* Subtle ambient gradients - Premium blue showroom */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(59,130,246,0.04),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_30%,rgba(59,130,246,0.03),transparent_40%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(59,130,246,0.08),transparent_50%)]" />
          
          {/* Dynamic Spotlight - Desktop only */}
          <div 
            className="hidden md:block absolute right-[10%] lg:right-[15%] w-[400px] md:w-[500px] lg:w-[600px] h-[400px] md:h-[500px] lg:h-[600px] pointer-events-none will-change-transform"
            style={{ 
              transform: `translateY(${parallaxY * 0.5}px)`,
              top: '20%',
              background: 'radial-gradient(ellipse 60% 50% at center, rgba(59,130,246,0.12), rgba(100,160,255,0.06) 40%, transparent 70%)',
              filter: 'blur(40px)'
            }}
          />
          {/* Secondary spotlight - Desktop only */}
          <div 
            className="hidden md:block absolute right-[15%] lg:right-[20%] w-[300px] md:w-[400px] h-[300px] md:h-[400px] pointer-events-none will-change-transform"
            style={{ 
              transform: `translateY(${parallaxY * 0.3}px)`,
              top: '25%',
              background: 'radial-gradient(circle at center, rgba(140,180,255,0.15), transparent 60%)',
              filter: 'blur(60px)'
            }}
          />
          
          {/* Mobile spotlight - Positioned with the car */}
          <div 
            className="md:hidden absolute left-1/2 -translate-x-1/2 w-[350px] h-[200px] pointer-events-none"
            style={{ 
              bottom: '53%',
              background: 'radial-gradient(ellipse 80% 70% at center, rgba(59,130,246,0.18), rgba(100,160,255,0.06) 50%, transparent 85%)',
              filter: 'blur(25px)'
            }}
          />
          
          {/* Fog/Mist Effect at the base - reduced on mobile to not cover lights */}
          <div 
            className="absolute bottom-0 left-0 right-0 h-[18%] md:h-[35%] pointer-events-none"
            style={{ 
              background: 'linear-gradient(to top, rgba(10,10,15,0.95) 0%, rgba(20,25,40,0.4) 30%, rgba(40,60,100,0.15) 60%, transparent 100%)',
            }}
          />
          {/* Fog layer 2 - softer blue tint */}
          <div 
            className="absolute bottom-0 left-0 right-0 h-[15%] md:h-[25%] pointer-events-none"
            style={{ 
              background: 'linear-gradient(to top, rgba(30,50,80,0.3) 0%, rgba(60,100,150,0.1) 50%, transparent 100%)',
              filter: 'blur(20px)',
            }}
          />
          {/* Fog wisps - hidden on mobile for cleaner look */}
          <div 
            className="hidden md:block absolute bottom-[5%] left-0 right-0 h-[15%] pointer-events-none opacity-40"
            style={{ 
              background: 'radial-gradient(ellipse 80% 100% at 30% 100%, rgba(80,120,180,0.25), transparent 50%), radial-gradient(ellipse 60% 80% at 70% 100%, rgba(100,140,200,0.2), transparent 50%)',
              filter: 'blur(30px)',
              animation: 'floatParticle 12s ease-in-out infinite alternate',
            }}
          />

          {/* Particles - hidden on mobile for performance */}
          <div className="hidden md:block absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p) => (
              <div
                key={p.id}
                className="absolute rounded-full"
                style={{
                  width: p.size,
                  height: p.size,
                  left: `${p.left}%`,
                  bottom: '25%',
                  background: 'rgba(140,180,255,0.6)',
                  boxShadow: '0 0 6px rgba(140,180,255,0.5)',
                  animation: `floatParticle ${p.duration}s ease-in-out infinite`,
                  animationDelay: `${p.delay}s`,
                  opacity: 0
                }}
              />
            ))}
          </div>

          <div className="relative max-w-7xl mx-auto px-4 md:px-8 h-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-8 items-center min-h-[420px] sm:min-h-[480px] md:min-h-[550px] lg:min-h-[600px]">
              
              {/* 1. Logo - order-1 always */}
              <div 
                className={`order-1 lg:row-span-1 flex items-center gap-4 justify-center lg:justify-start pt-6 sm:pt-8 lg:pt-16 transition-all duration-700 delay-100 ${
                  isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
              >
                <img 
                  src={carNeonLogo} 
                  alt="UbadeskCar" 
                  className="h-28 sm:h-36 md:h-44 lg:h-52 w-auto"
                  style={{ filter: 'drop-shadow(0 0 18px rgba(59,130,246,0.35))' }}
                />
                <span className="text-2xl sm:text-3xl md:text-4xl font-bold">
                  <span className="text-white">Ubadesk</span>
                  <span className="text-blue-500">Car</span>
                </span>
              </div>

              {/* Desktop Content - Hidden on mobile, shown on lg+ */}
              <div className="hidden lg:block order-2 lg:col-start-1 lg:row-start-2 py-8 md:py-0">
                <h1 
                  className={`text-5xl lg:text-6xl font-bold text-white mb-2 leading-tight transition-all duration-700 delay-200 ${
                    isLoaded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
                  }`}
                >
                  Linha Automotiva
                </h1>
                <h2 
                  className={`text-4xl lg:text-5xl font-bold text-blue-500 mb-8 transition-all duration-700 delay-300 ${
                    isLoaded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
                  }`}
                >
                  Profissional
                </h2>
                
                <div 
                  className={`flex flex-col items-start gap-4 transition-all duration-700 delay-400 ${
                    isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                >
                  <Button 
                    onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-6 text-lg font-semibold rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(59,130,246,0.5)]"
                    style={{ boxShadow: '0 0 20px rgba(59,130,246,0.3)' }}
                  >
                    <Car className="mr-2 h-5 w-5" />
                    Ver produtos
                  </Button>

                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      type="text"
                      placeholder="Buscar produtos automotivos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-11 pr-10 py-5 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* 2. Car - order-2 on mobile, spans right side on desktop */}
              <div 
                className={`relative order-2 lg:order-3 lg:col-start-2 lg:row-start-1 lg:row-span-2 flex items-center justify-center lg:justify-end transition-all duration-1000 delay-300 ${
                  isLoaded ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-10 scale-95'
                }`}
              >
                <div 
                  className="relative w-full max-w-[260px] sm:max-w-[300px] md:max-w-lg lg:max-w-none will-change-transform"
                  style={{ 
                    transform: `translate3d(0, ${parallaxY}px, 0)`,
                    backfaceVisibility: 'hidden'
                  }}
                >
                  <img 
                    src={carHeroImage} 
                    alt="Linha Automotiva Profissional" 
                    className="w-full h-auto object-contain drop-shadow-2xl"
                  />

                  {/* Light sweep effect - usa CSS mask para limitar aos pixels do carro */}
                  <div 
                    className="absolute inset-0 pointer-events-none overflow-hidden"
                    style={{
                      maskImage: `url(${carHeroImage})`,
                      WebkitMaskImage: `url(${carHeroImage})`,
                      maskSize: 'contain',
                      WebkitMaskSize: 'contain',
                      maskRepeat: 'no-repeat',
                      WebkitMaskRepeat: 'no-repeat',
                      maskPosition: 'center',
                      WebkitMaskPosition: 'center',
                    }}
                  >
                    <div
                      className="absolute h-full w-[40%] -skew-x-12"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35) 50%, transparent)',
                        animation: 'lightSweep 6s ease-in-out infinite',
                        animationDelay: '2s'
                      }}
                    />
                  </div>
                  
                  <div 
                    className="absolute top-full left-0 w-full h-32 overflow-hidden pointer-events-none"
                  >
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

              {/* 3. Title - order-3 on mobile only */}
              <div 
                className={`lg:hidden order-3 text-center transition-all duration-700 delay-200 ${
                  isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
              >
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1 leading-tight">
                  Linha Automotiva
                </h1>
                <h2 className="text-2xl sm:text-3xl font-bold text-blue-500">
                  Profissional
                </h2>
              </div>

              {/* 4. Button - order-4 on mobile only */}
              <div 
                className={`lg:hidden order-4 flex justify-center transition-all duration-700 delay-300 ${
                  isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
              >
                <Button 
                  onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-5 text-base font-semibold rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(59,130,246,0.5)]"
                  style={{ boxShadow: '0 0 20px rgba(59,130,246,0.3)' }}
                >
                  <Car className="mr-2 h-5 w-5" />
                  Ver produtos
                </Button>
              </div>

              {/* 5. Search - order-5 on mobile only */}
              <div 
                className={`lg:hidden order-5 flex justify-center pb-6 transition-all duration-700 delay-400 ${
                  isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
              >
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    type="text"
                    placeholder="Buscar produtos automotivos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-11 pr-10 py-5 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              
            </div>
          </div>
        </section>

        {/* Products Section */}
        <section id="products" className="py-12 md:py-16 px-4 md:px-8" style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #0a1628 50%, #0f1f3d 100%)' }}>
          <div className="max-w-7xl mx-auto">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
            ) : filteredProducts.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-8">
                  <p className="text-blue-300/60">
                    {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onShowDetails={() => handleShowDetails(product)}
                      variant="automotive"
                    />
                  ))}
                </div>
              </>
            ) : automotiveProducts.length === 0 ? (
              <div className="text-center py-16">
                <div className="p-6 rounded-full bg-blue-500/10 w-fit mx-auto mb-6">
                  <Car className="h-12 w-12 text-blue-400" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">
                  Em breve
                </h3>
                <p className="text-blue-300/60 mb-6 max-w-md mx-auto">
                  Estamos preparando nossa linha automotiva profissional. Volte em breve para conferir nossos produtos!
                </p>
                <Link to="/">
                  <Button variant="outline" className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10">
                    Voltar ao Início
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-blue-300/60 mb-4">
                  Nenhum produto encontrado para "{searchTerm}"
                </p>
                <Button variant="outline" onClick={() => setSearchTerm('')} className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10">
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

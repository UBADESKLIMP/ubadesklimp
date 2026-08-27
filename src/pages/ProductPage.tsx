import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import NotFound from './NotFound';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useProducts } from '@/hooks/useProducts';
import { useCart } from '@/contexts/CartContext';
import { toast } from '@/hooks/use-toast';
import { ProductWithVariations, ProductVariation, ProductFragrance } from '@/types/product';

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(price);
};

const getUnitBadge = (value: string, sizeUnit?: string) => {
  const valueLower = value.toLowerCase();

  if (valueLower.match(/\d+\s*cm\b/)) {
    return <span className="text-xs bg-orange-500/20 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">📏 Tamanho</span>;
  }
  if (valueLower.match(/\d+\s*(kg|g)\b/)) {
    return <span className="text-xs bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">⚖️ Peso</span>;
  }
  if (valueLower.match(/unidades?\b/)) {
    return <span className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">📦 Unidades</span>;
  }
  if (valueLower.match(/\d+\s*(l|ml)\b|litros?\b/)) {
    return <span className="text-xs bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-full">💧 Volume</span>;
  }

  if (sizeUnit) {
    switch (sizeUnit) {
      case 'cm':
        return <span className="text-xs bg-orange-500/20 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">📏 Tamanho</span>;
      case 'kg':
      case 'g':
        return <span className="text-xs bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">⚖️ Peso</span>;
      case 'unidades':
        return <span className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">📦 Unidades</span>;
      case 'litros':
      case 'ml':
        return <span className="text-xs bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-full">💧 Volume</span>;
    }
  }

  return <span className="text-xs bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-full">💧 Volume</span>;
};

const ProductPageSkeleton = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <main className="pt-14 md:pt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid md:grid-cols-2 gap-8">
        <Skeleton className="h-[500px] w-full rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-1/2" />
        </div>
      </div>
    </main>
    <Footer />
  </div>
);

const ProductPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { products, loading, error } = useProducts();
  const { addToCart } = useCart();

  const product = products.find((p) => p.slug === slug) ?? null;

  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [selectedFragrance, setSelectedFragrance] = useState<ProductFragrance | null>(null);

  useEffect(() => {
    if (product?.has_variations && product.variations?.length > 0) {
      const primaryVariation = product.variations.find((v) => v.is_primary) || product.variations[0];
      setSelectedVariation(primaryVariation);
    } else {
      setSelectedVariation(null);
    }

    if (product?.has_fragrances && product.fragrances?.length > 0) {
      setSelectedFragrance(product.fragrances[0]);
    } else {
      setSelectedFragrance(null);
    }
  }, [product]);

  useEffect(() => {
    if (product?.has_variations && product.variations && selectedFragrance) {
      const availableVariations = product.variations.filter((variation) => {
        if (selectedFragrance.available_literages && selectedFragrance.available_literages.length > 0) {
          return selectedFragrance.available_literages.includes(variation.literage);
        }
        return true;
      });

      if (selectedVariation && availableVariations.length > 0) {
        const isCurrentVariationAvailable = availableVariations.some((v) => v.id === selectedVariation.id);
        if (!isCurrentVariationAvailable) {
          const primaryVariation = availableVariations.find((v) => v.is_primary) || availableVariations[0];
          setSelectedVariation(primaryVariation);
        }
      } else if (availableVariations.length > 0) {
        const primaryVariation = availableVariations.find((v) => v.is_primary) || availableVariations[0];
        setSelectedVariation(primaryVariation);
      }
    }
  }, [selectedFragrance, product]);

  if (loading) {
    return <ProductPageSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-14 md:pt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-4">
            <h1 className="text-2xl font-bold">Não foi possível carregar o produto</h1>
            <p className="text-muted-foreground">
              Verifique sua conexão com a internet e tente novamente.
            </p>
            <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return <NotFound />;
  }

  const getCurrentPrice = () => {
    if (product.has_variations && product.variations?.length > 0 && selectedVariation) {
      return selectedVariation.price;
    }
    if (product.price) {
      return product.price;
    }
    return 0;
  };

  const getCurrentImage = () => {
    if (selectedFragrance?.image_url) {
      return selectedFragrance.image_url;
    }
    if (selectedVariation?.image_url) {
      return selectedVariation.image_url;
    }
    if (product.image_url) {
      return product.image_url;
    }
    return null;
  };

  const handleAddToCart = () => {
    let productName = product.name;
    let productId = product.id;

    if (product.has_variations && selectedVariation) {
      productName += ` - ${selectedVariation.literage}`;
      productId += `-${selectedVariation.id}`;
    }

    if (product.has_fragrances && selectedFragrance) {
      productName += ` - ${selectedFragrance.name}`;
      productId += `-${selectedFragrance.id}`;
    }

    if (product.has_variations && product.variations?.length > 0 && selectedVariation) {
      addToCart({
        id: productId,
        name: productName,
        price: selectedVariation.price,
        category: product.category,
        variation: selectedVariation,
        fragrance: selectedFragrance,
        productId: product.id,
        image_url: getCurrentImage() || undefined
      });
    } else if (product.price) {
      addToCart({
        id: productId,
        name: productName,
        price: product.price,
        category: product.category,
        fragrance: selectedFragrance,
        productId: product.id,
        image_url: getCurrentImage() || undefined
      });
    }

    toast({
      title: 'Produto adicionado!',
      description: `${productName} foi adicionado ao carrinho.`
    });
  };

  const backTo = product.line_type === 'automotivo' ? '/automotivo' : '/';

  const similarProducts = products
    .filter((p) => p.id !== product.id && p.category === product.category && p.line_type === product.line_type)
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-14 md:pt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Link to={backTo} className="inline-flex items-center text-primary hover:text-primary/80 mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Imagem e compra */}
            <div className="space-y-4">
              <div className="relative w-full bg-white rounded-lg border border-border overflow-hidden">
                <div className="h-[500px] flex items-center justify-center p-4">
                  {getCurrentImage() ? (
                    <img
                      src={getCurrentImage()!}
                      alt={product.name}
                      className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-6xl text-muted-foreground">📦</div>
                  )}
                </div>

                {product.priority && (
                  <div className="absolute top-4 left-4">
                    <div className="bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 text-white px-3 py-1.5 rounded-full shadow-lg">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                        <span className="text-xs font-bold tracking-wider uppercase">
                          Produto Destaque
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-6 space-y-4">
                {product.has_fragrances && product.fragrances && product.fragrances.length > 0 && (
                  <div className="space-y-3">
                    <label className="font-medium">Escolha a fragrância:</label>
                    <Select
                      value={selectedFragrance?.id || ''}
                      onValueChange={(value) => {
                        const fragrance = product.fragrances?.find((f) => f.id === value);
                        setSelectedFragrance(fragrance || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a fragrância" />
                      </SelectTrigger>
                      <SelectContent>
                        {product.fragrances.map((fragrance) => (
                          <SelectItem key={fragrance.id} value={fragrance.id}>
                            {fragrance.name}
                            {fragrance.description && ` - ${fragrance.description}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {product.has_variations && product.variations && product.variations.length > 0 && (
                  <div className="space-y-3">
                    <label className="font-medium">
                      {product.variations[0]?.literage.match(/cm/i) ? 'Escolha o tamanho:' :
                       product.variations[0]?.literage.match(/kg|g/i) ? 'Escolha o peso:' :
                       product.variations[0]?.literage.match(/unidade/i) ? 'Escolha a quantidade:' : 'Escolha o volume:'}
                    </label>
                    <Select
                      value={selectedVariation?.id || ''}
                      onValueChange={(value) => {
                        const variation = product.variations.find((v) => v.id === value);
                        setSelectedVariation(variation || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={
                          product.variations[0]?.literage.match(/cm/i) ? 'Selecione o tamanho' :
                          product.variations[0]?.literage.match(/kg|g/i) ? 'Selecione o peso' :
                          product.variations[0]?.literage.match(/unidade/i) ? 'Selecione a quantidade' : 'Selecione o volume'
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {product.variations
                          .filter((variation) => {
                            if (selectedFragrance?.available_literages && selectedFragrance.available_literages.length > 0) {
                              return selectedFragrance.available_literages.includes(variation.literage);
                            }
                            return true;
                          })
                          .map((variation) => (
                            <SelectItem key={variation.id} value={variation.id}>
                              {variation.literage} - {formatPrice(variation.price)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {product.out_of_stock && (
                  <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-center">
                    <span className="text-destructive font-semibold">⚠️ Produto Esgotado</span>
                    <p className="text-sm text-muted-foreground mt-1">Este produto está temporariamente indisponível</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold text-primary">
                    {product.out_of_stock ? 'Em Falta' :
                      (getCurrentPrice() > 0 ? formatPrice(getCurrentPrice()) : 'Indisponível')
                    }
                  </span>
                </div>

                <Button
                  onClick={handleAddToCart}
                  className="w-full btn-secondary text-lg py-3"
                  disabled={getCurrentPrice() === 0 || product.out_of_stock}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  {product.out_of_stock ? 'Produto Esgotado' : 'Comprar Agora'}
                </Button>
              </div>
            </div>

            {/* Detalhes do produto */}
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold mb-2">{product.name}</h1>
                <p className="text-sm text-primary font-medium uppercase tracking-wide">{product.category}</p>
              </div>

              <div className="space-y-4">
                <h2 className="font-semibold text-lg">Especificações:</h2>
                <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                  {product.material && (
                    <div className="flex justify-between">
                      <span className="font-medium">Material:</span>
                      <span className="text-muted-foreground">{product.material}</span>
                    </div>
                  )}
                  {product.has_variations && selectedVariation ? (
                    <div className="flex justify-between items-center">
                      {getUnitBadge(selectedVariation.literage, product.size_unit)}
                      <span className="text-muted-foreground">{selectedVariation.literage}</span>
                    </div>
                  ) : !product.has_variations && product.literage_single && (
                    <div className="flex justify-between items-center">
                      {getUnitBadge(product.literage_single, product.size_unit)}
                      <span className="text-muted-foreground">{product.literage_single}</span>
                    </div>
                  )}
                  {product.validity && (
                    <div className="flex justify-between">
                      <span className="font-medium">Validade:</span>
                      <span>{product.validity}</span>
                    </div>
                  )}
                </div>
                {product.specifications && (
                  <div>
                    <p className="text-sm text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded whitespace-pre-wrap">
                      {product.specifications}
                    </p>
                  </div>
                )}

                {(product.action_type || product.ph_level || product.application_area) && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <h3 className="font-medium text-sm mb-3 text-blue-400">Detalhes Técnicos</h3>
                    <div className="space-y-2">
                      {product.action_type && (
                        <div className="flex justify-between">
                          <span className="font-medium">Ação:</span>
                          <span className="text-muted-foreground">{product.action_type}</span>
                        </div>
                      )}
                      {product.ph_level && (
                        <div className="flex justify-between">
                          <span className="font-medium">PH:</span>
                          <span className="text-muted-foreground">{product.ph_level}</span>
                        </div>
                      )}
                      {product.application_area && (
                        <div className="flex justify-between">
                          <span className="font-medium">{product.line_type === 'limpeza' ? 'Uso Indicado:' : 'Local de Aplicação:'}</span>
                          <span className="text-muted-foreground">{product.application_area}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Produtos semelhantes */}
          {similarProducts.length >= 2 && (
            <div className="mt-16">
              <h2 className="text-2xl font-heading mb-6">Produtos semelhantes</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {similarProducts.map((similar) => (
                  <ProductCard
                    key={similar.id}
                    product={similar}
                    onShowDetails={() => navigate(`/produto/${similar.slug}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductPage;

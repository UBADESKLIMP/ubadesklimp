import { useEffect } from 'react';
import { ProductWithVariations } from '@/types/product';

export const useImagePreload = (products: ProductWithVariations[], maxPreload: number = 8) => {
  useEffect(() => {
    if (products.length === 0) return;

    // Filtrar produtos prioritários ou com destaque primeiro
    const priorityProducts = products
      .filter(p => p.priority || p.highlight_type)
      .slice(0, maxPreload);

    // Se não houver suficientes prioritários, pegar os primeiros produtos
    const productsToPreload = priorityProducts.length >= maxPreload 
      ? priorityProducts 
      : [...priorityProducts, ...products.filter(p => !p.priority && !p.highlight_type)]
          .slice(0, maxPreload);

    // Fazer preload das imagens
    productsToPreload.forEach(product => {
      const imageUrl = product.image_url || 
        (product.variations && product.variations.length > 0 ? product.variations[0].image_url : null);
      
      if (imageUrl) {
        const img = new Image();
        img.src = imageUrl;
      }
    });
  }, [products, maxPreload]);
};

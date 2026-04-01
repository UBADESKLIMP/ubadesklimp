
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ProductWithVariations } from '@/types/product';

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  priority: boolean;
  highlight_type?: 'bestseller' | 'promotion' | 'new' | 'featured' | 'none' | null;
  created_at: string;
  updated_at: string;
}

export const useProducts = () => {
  const [products, setProducts] = useState<ProductWithVariations[]>([]);
  const [loading, setLoading] = useState(true);

  // Sanitize payload to only include columns that exist in 'products' table
  const sanitizeProductPayload = (data: any) => {
    if (!data) return {};
    const allowedKeys = [
      'name',
      'description',
      'price',
      'category',
      'image_url',
      'priority',
      'priority_order',
      'has_variations',
      'has_fragrances',
      'highlight_type',
      'material',
      'validity',
      'specifications',
      'literage_single',
      'out_of_stock',
      'size_unit',
      'price_position',
      'action_type',
      'ph_level',
      'application_area',
      'line_type',
      'brand'
    ];
    const payload: Record<string, any> = {};
    for (const key of allowedKeys) {
      if (key in data) payload[key] = (data as any)[key];
    }
    return payload;
  };

  const fetchProducts = async () => {
    // Só mostrar loading no primeiro carregamento para evitar "flash" do modal
    const isInitialLoad = products.length === 0;
    if (isInitialLoad) {
      setLoading(true);
    }
    try {
      // Buscar todos os produtos, variações e fragrâncias em paralelo (3 queries ao invés de N+1)
      const [productsResult, variationsResult, fragrancesResult] = await Promise.all([
        supabase
          .from('products')
          .select('id,name,description,price,category,image_url,priority,priority_order,has_variations,has_fragrances,highlight_type,material,validity,specifications,out_of_stock,literage_single,size_unit,price_position,action_type,ph_level,application_area,line_type,brand,display_order,created_at,updated_at')
          .order('display_order', { ascending: true })
          .order('priority', { ascending: false })
          .order('priority_order', { ascending: true })
          .order('created_at', { ascending: false }),
        supabase
          .from('product_variations')
          .select('id,product_id,literage,price,image_url,is_primary,display_order,created_at,updated_at')
          .order('created_at', { ascending: true }),
        supabase
          .from('product_fragrances')
          .select('id,product_id,name,description,image_url,available_literages,order_index')
          .order('order_index', { ascending: true })
      ]);

      if (productsResult.error) throw productsResult.error;

      const productsData = productsResult.data || [];
      const allVariations = variationsResult.data || [];
      const allFragrances = fragrancesResult.data || [];

      // Associar variações e fragrâncias aos produtos no cliente
      const productsWithVariations: ProductWithVariations[] = productsData.map((product) => {
        const variations = allVariations.filter(v => v.product_id === product.id);
        const fragrances = allFragrances
          .filter(f => f.product_id === product.id)
          .map(item => ({
            id: item.id,
            name: item.name,
            description: item.description || undefined,
            image_url: item.image_url || undefined,
            available_literages: item.available_literages || [],
            order: item.order_index
          }));

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          category: product.category,
          image_url: product.image_url,
          priority: product.priority,
          priority_order: product.priority_order || 0,
          has_variations: product.has_variations || false,
          has_fragrances: fragrances.length > 0,
          highlight_type: (product as any).highlight_type || null,
          material: product.material,
          validity: product.validity,
          specifications: product.specifications,
          out_of_stock: product.out_of_stock || false,
          literage_single: product.literage_single,
          size_unit: (product.size_unit || 'litros') as 'litros' | 'cm' | 'ml' | 'kg' | 'g' | 'unidades',
          price_position: (product.price_position || 'below_text') as 'below_image' | 'below_text',
          action_type: product.action_type || null,
          ph_level: product.ph_level || null,
          application_area: product.application_area || null,
          line_type: (product.line_type || 'limpeza') as 'limpeza' | 'automotivo',
          brand: product.brand || null,
          created_at: product.created_at,
          updated_at: product.updated_at,
          variations: variations,
          fragrances: fragrances,
          price: product.price
        };
      });

      setProducts(productsWithVariations);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Erro ao carregar produtos",
        description: "Não foi possível carregar os produtos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const payload = sanitizeProductPayload(productData) as any;
      const { data, error } = await supabase
        .from('products')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      await fetchProducts();
      toast({
        title: "Produto criado",
        description: "Produto adicionado com sucesso.",
      });
      return data;
    } catch (error) {
      console.error('Error creating product:', error);
      toast({
        title: "Erro ao criar produto",
        description: "Não foi possível criar o produto.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateProduct = async (id: string, productData: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>) => {
    try {
      const payload = sanitizeProductPayload(productData) as any;
      const { data, error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await fetchProducts();
      toast({
        title: "Produto atualizado",
        description: "Produto atualizado com sucesso.",
      });
      return data;
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: "Erro ao atualizar produto",
        description: "Não foi possível atualizar o produto.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProducts(prev => prev.filter(p => p.id !== id));
      toast({
        title: "Produto removido",
        description: "Produto removido com sucesso.",
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Erro ao remover produto",
        description: "Não foi possível remover o produto.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateDisplayOrder = async (orderedProducts: ProductWithVariations[]) => {
    try {
      // Batch update display_order for all products
      const updates = orderedProducts.map((product, index) => ({
        id: product.id,
        display_order: index + 1
      }));

      // Update each product's display_order
      await Promise.all(
        updates.map(({ id, display_order }) =>
          supabase
            .from('products')
            .update({ display_order })
            .eq('id', id)
        )
      );

      // Update local state without refetching
      setProducts(orderedProducts.map((p, i) => ({ ...p, display_order: i + 1 })));

      toast({
        title: "Ordem atualizada",
        description: "A ordem dos produtos foi salva com sucesso.",
      });
    } catch (error) {
      console.error('Error updating display order:', error);
      toast({
        title: "Erro ao atualizar ordem",
        description: "Não foi possível salvar a nova ordem dos produtos.",
        variant: "destructive"
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return {
    products,
    loading,
    createProduct,
    updateProduct,
    deleteProduct,
    updateDisplayOrder,
    refetch: fetchProducts
  };
};

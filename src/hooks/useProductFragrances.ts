import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { ProductFragrance } from '@/types/product';

export const useProductFragrances = (productId: string) => {
  const [fragrances, setFragrances] = useState<ProductFragrance[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFragrances = async () => {
    if (!productId) return;
    
    setLoading(true);
    try {
      // Usar localStorage para armazenar fragrâncias por enquanto
      const stored = localStorage.getItem(`fragrances_${productId}`);
      setFragrances(stored ? JSON.parse(stored) : []);
    } catch (error) {
      console.error('Error fetching fragrances:', error);
      setFragrances([]);
    } finally {
      setLoading(false);
    }
  };

  const saveFragrances = async (newFragrances: ProductFragrance[]) => {
    if (!productId) return;

    try {
      // Salvar no localStorage
      localStorage.setItem(`fragrances_${productId}`, JSON.stringify(newFragrances));
      setFragrances(newFragrances);
      
      toast({
        title: "Fragrâncias salvas",
        description: "As fragrâncias foram salvas com sucesso.",
      });
    } catch (error) {
      console.error('Error saving fragrances:', error);
      toast({
        title: "Erro ao salvar fragrâncias",
        description: "Não foi possível salvar as fragrâncias.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchFragrances();
  }, [productId]);

  return {
    fragrances,
    loading,
    saveFragrances,
    refetch: fetchFragrances
  };
};
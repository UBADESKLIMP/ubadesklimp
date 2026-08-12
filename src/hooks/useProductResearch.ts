import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { extractFunctionErrorMessage } from '@/lib/functionErrors';
import { ProductResearchResult } from '@/types/productResearch';

export const useProductResearch = () => {
  const [researching, setResearching] = useState(false);

  const research = async (
    name: string,
    sizeHint: string,
    lineType: 'limpeza' | 'automotivo'
  ): Promise<ProductResearchResult | null> => {
    setResearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('research-product', {
        body: { name, sizeHint, lineType },
      });
      if (error) {
        const message = await extractFunctionErrorMessage(error, 'Não foi possível pesquisar esse produto.');
        toast({ title: 'Erro na pesquisa', description: message, variant: 'destructive' });
        return null;
      }
      return data as ProductResearchResult;
    } catch (error) {
      console.error('Error researching product:', error);
      toast({
        title: 'Erro na pesquisa',
        description: 'Não foi possível pesquisar esse produto. Tente novamente.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setResearching(false);
    }
  };

  return { research, researching };
};

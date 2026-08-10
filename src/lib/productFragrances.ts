import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductFragrance } from '@/types/product';

// Upsert-by-id em vez de apagar tudo e recriar: fragrâncias que já existiam
// (id real do banco) são atualizadas no lugar, preservando o id. Isso importa
// porque missing_products.fragrance_id tem "on delete cascade" — recriar a
// fragrância com um id novo a cada save apagaria silenciosamente qualquer
// faltante pendente daquela fragrância, mesmo num save que só mudou o preço
// do produto. O id só muda de verdade quando o usuário remove a fragrância.
export async function syncProductFragrances(
  supabase: SupabaseClient,
  productId: string,
  previousFragrances: ProductFragrance[],
  newFragrances: ProductFragrance[]
): Promise<void> {
  const previousIds = new Set(previousFragrances.map((f) => f.id));
  const submittedIds = new Set(newFragrances.map((f) => f.id));

  const toDeleteIds = previousFragrances
    .map((f) => f.id)
    .filter((id) => !submittedIds.has(id));

  if (toDeleteIds.length > 0) {
    const { error } = await supabase
      .from('product_fragrances')
      .delete()
      .in('id', toDeleteIds);
    if (error) throw error;
  }

  const toUpdate = newFragrances.filter((f) => previousIds.has(f.id));
  for (const fragrance of toUpdate) {
    const { error } = await supabase
      .from('product_fragrances')
      .update({
        name: fragrance.name,
        description: fragrance.description || null,
        image_url: fragrance.image_url || null,
        available_literages: fragrance.available_literages || [],
        order_index: fragrance.order || 0,
      })
      .eq('id', fragrance.id);
    if (error) throw error;
  }

  const toInsert = newFragrances.filter((f) => !previousIds.has(f.id));
  if (toInsert.length > 0) {
    const { error } = await supabase.from('product_fragrances').insert(
      toInsert.map((fragrance) => ({
        product_id: productId,
        name: fragrance.name,
        description: fragrance.description || null,
        image_url: fragrance.image_url || null,
        available_literages: fragrance.available_literages || [],
        order_index: fragrance.order || 0,
      }))
    );
    if (error) throw error;
  }

  const { error: flagError } = await supabase
    .from('products')
    .update({ has_fragrances: newFragrances.length > 0 })
    .eq('id', productId);
  if (flagError) throw flagError;
}

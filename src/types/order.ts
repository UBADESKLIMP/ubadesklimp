import { cartItemSchema, type CartItem } from '@/lib/validations';
import type { Tables, Json } from '@/integrations/supabase/types';

export type OrderRow = Tables<'orders'>;

// Um item de orders.items que não bateu com cartItemSchema (pedido gravado
// antes desse schema existir, ou dado corrompido). Os campos opcionais que
// CartItem também tem ficam como `undefined` aqui, pra quem consome OrderItem
// não precisar de narrowing pra acessá-los.
export interface UnrecognizedOrderItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  productId?: undefined;
  image_url?: undefined;
  variation?: undefined;
  fragrance?: undefined;
  unrecognized: true;
}

export type OrderItem = CartItem | UnrecognizedOrderItem;

/**
 * Converte o JSON livre de orders.items numa lista tipada. Itens que não
 * batem com cartItemSchema (pedidos antigos, dado corrompido) viram um
 * placeholder "Item não reconhecido" em vez de quebrar a tela ou sumir —
 * mesma filosofia que validateCartState já usa pro localStorage do carrinho.
 */
export const parseOrderItems = (raw: Json, orderId: string): OrderItem[] => {
  if (!Array.isArray(raw)) {
    if (raw !== null && raw !== undefined) {
      console.warn(`Pedido ${orderId}: campo items não é uma lista, ignorando.`);
    }
    return [];
  }

  return raw.map((rawItem, index) => {
    const result = cartItemSchema.safeParse(rawItem);
    if (result.success) return result.data;

    console.warn(`Pedido ${orderId}: item ${index} não reconhecido`, result.error.flatten());

    const obj = rawItem && typeof rawItem === 'object' ? (rawItem as Record<string, unknown>) : {};
    const quantity = typeof obj.quantity === 'number' && Number.isFinite(obj.quantity) ? obj.quantity : 0;
    const price = typeof obj.price === 'number' && Number.isFinite(obj.price) ? obj.price : 0;

    return {
      id: typeof obj.id === 'string' ? obj.id : `unrecognized-${orderId}-${index}`,
      name: 'Item não reconhecido',
      category: '',
      quantity,
      price,
      unrecognized: true as const,
    };
  });
};

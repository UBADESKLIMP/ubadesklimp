
import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { ProductVariation } from '@/types/product';

export interface CartItem {
  id: string;
  name: string;
  price: string;
  quantity: number;
  category: string;
  variation?: ProductVariation;
  productId?: string; // Para poder buscar outras variações
}

interface CartState {
  items: CartItem[];
  total: number;
}

type CartAction = 
  | { type: 'ADD_ITEM'; payload: Omit<CartItem, 'quantity'> }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'UPDATE_VARIATION'; payload: { id: string; variation: ProductVariation; newPrice: string; productId: string } }
  | { type: 'CLEAR_CART' };

const CartContext = createContext<{
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateVariation: (id: string, variation: ProductVariation, newPrice: string, productId: string) => void;
  clearCart: () => void;
  getWhatsAppLink: () => string;
} | undefined>(undefined);

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingItem = state.items.find(item => item.id === action.payload.id);
      
      if (existingItem) {
        const updatedItems = state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
        return {
          ...state,
          items: updatedItems,
        };
      }
      
      return {
        ...state,
        items: [...state.items, { ...action.payload, quantity: 1 }],
      };
    }
    
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload),
      };
    
    case 'UPDATE_QUANTITY':
      if (action.payload.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter(item => item.id !== action.payload.id),
        };
      }
      
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: action.payload.quantity }
            : item
        ),
      };

    case 'UPDATE_VARIATION':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { 
                ...item, 
                id: `${action.payload.productId}-${action.payload.variation.id}`,
                variation: action.payload.variation,
                price: action.payload.newPrice,
                name: item.name.split(' - ')[0] + ' - ' + action.payload.variation.literage,
                productId: action.payload.productId
              }
            : item
        ),
      };
    
    case 'CLEAR_CART':
      return {
        ...state,
        items: [],
      };
    
    default:
      return state;
  }
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(cartReducer, { items: [], total: 0 });

  const addToCart = (item: Omit<CartItem, 'quantity'>) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  };

  const removeFromCart = (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: id });
  };

  const updateQuantity = (id: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  };

  const updateVariation = (id: string, variation: ProductVariation, newPrice: string, productId: string) => {
    dispatch({ type: 'UPDATE_VARIATION', payload: { id, variation, newPrice, productId } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const getWhatsAppLink = () => {
    if (state.items.length === 0) return '';
    
    let message = '🛒 *Pedido Ubadesklimp*\n\n';
    
    state.items.forEach(item => {
      message += `• ${item.name}\n`;
      message += `  Categoria: ${item.category}\n`;
      message += `  Preço: ${item.price}\n`;
      message += `  Quantidade: ${item.quantity}\n\n`;
    });
    
    message += `📞 Gostaria de finalizar este pedido!`;
    
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/551238332434?text=${encodedMessage}`;
  };

  return (
    <CartContext.Provider value={{
      state,
      dispatch,
      addToCart,
      removeFromCart,
      updateQuantity,
      updateVariation,
      clearCart,
      getWhatsAppLink,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

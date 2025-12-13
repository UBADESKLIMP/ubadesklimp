import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { ProductVariation, ProductFragrance } from '@/types/product';

export interface CartItem {
  id: string;
  name: string;
  price: string;
  quantity: number;
  category: string;
  variation?: ProductVariation;
  fragrance?: ProductFragrance;
  productId?: string; // Para poder buscar outras variações
  image_url?: string; // Imagem principal do produto
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
  | { type: 'UPDATE_FRAGRANCE'; payload: { id: string; fragrance: ProductFragrance; productId: string } }
  | { type: 'CLEAR_CART' };

const CartContext = createContext<{
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateVariation: (id: string, variation: ProductVariation, newPrice: string, productId: string) => void;
  updateFragrance: (id: string, fragrance: ProductFragrance, productId: string) => void;
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

    case 'UPDATE_VARIATION': {
      const newId = `${action.payload.productId}-${action.payload.variation.id}`;
      const currentItem = state.items.find(item => item.id === action.payload.id);
      const existingItemWithNewId = state.items.find(item => item.id === newId && item.id !== action.payload.id);
      
      if (!currentItem) return state;
      
      // Se já existe um item com o novo ID, mesclar as quantidades
      if (existingItemWithNewId) {
        const updatedItems = state.items
          .filter(item => item.id !== action.payload.id) // Remove o item atual
          .map(item => 
            item.id === newId 
              ? { ...item, quantity: item.quantity + currentItem.quantity } // Adiciona a quantidade ao item existente
              : item
          );
        
        return {
          ...state,
          items: updatedItems,
        };
      }
      
      // Se não existe conflito, apenas atualiza o item
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { 
                ...item, 
                id: newId,
                variation: action.payload.variation,
                price: action.payload.newPrice,
                name: item.name.split(' - ')[0] + ' - ' + action.payload.variation.literage,
                productId: action.payload.productId
              }
            : item
        ),
      };
    }
    
    case 'UPDATE_FRAGRANCE': {
      const currentItem = state.items.find(item => item.id === action.payload.id);
      if (!currentItem) return state;

      // Construir novo nome incluindo a fragrância
      let newName = currentItem.name.split(' - ')[0];
      
      // Adicionar variação se existir
      if (currentItem.variation) {
        newName += ` - ${currentItem.variation.literage}`;
      }
      
      // Adicionar a nova fragrância
      newName += ` - ${action.payload.fragrance.name}`;

      // Construir novo ID incluindo a fragrância
      const baseId = action.payload.productId;
      let newId = baseId;
      if (currentItem.variation) {
        newId += `-${currentItem.variation.id}`;
      }
      newId += `-${action.payload.fragrance.id}`;

      // Verificar se já existe um item com o novo ID
      const existingItemWithNewId = state.items.find(item => item.id === newId && item.id !== action.payload.id);
      
      // Se já existe, mesclar as quantidades
      if (existingItemWithNewId) {
        const updatedItems = state.items
          .filter(item => item.id !== action.payload.id)
          .map(item => 
            item.id === newId 
              ? { ...item, quantity: item.quantity + currentItem.quantity }
              : item
          );
        
        return {
          ...state,
          items: updatedItems,
        };
      }

      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { 
                ...item,
                id: newId,
                name: newName,
                fragrance: action.payload.fragrance,
                productId: action.payload.productId
              }
            : item
        ),
      };
    }
    
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
  // Inicializar estado do localStorage
  const [state, dispatch] = useReducer(cartReducer, { items: [], total: 0 }, (initial) => {
    try {
      const savedCart = localStorage.getItem('ubadesk_cart');
      if (savedCart) {
        return JSON.parse(savedCart);
      }
    } catch (error) {
      console.error('Erro ao carregar carrinho:', error);
    }
    return initial;
  });

  // Persistir carrinho no localStorage sempre que mudar
  React.useEffect(() => {
    try {
      localStorage.setItem('ubadesk_cart', JSON.stringify(state));
    } catch (error) {
      console.error('Erro ao salvar carrinho:', error);
    }
  }, [state]);

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

  const updateFragrance = (id: string, fragrance: ProductFragrance, productId: string) => {
    dispatch({ type: 'UPDATE_FRAGRANCE', payload: { id, fragrance, productId } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const getWhatsAppLink = () => {
    if (state.items.length === 0) return '';
    
    // Helper to sanitize and truncate text
    const sanitize = (text: string | undefined, maxLength: number): string => {
      if (!text) return '';
      return text.substring(0, maxLength).replace(/[\r\n]+/g, ' ').trim();
    };

    let message = '🛒 *Pedido Ubadesklimp*\n\n';
    const MAX_MESSAGE_LENGTH = 4000; // Safe limit for WhatsApp URLs
    
    state.items.forEach(item => {
      const safeName = sanitize(item.name, 100);
      const safeCategory = sanitize(item.category, 50);
      const safePrice = sanitize(item.price, 20);
      const safeQuantity = Math.min(Math.max(1, item.quantity || 1), 9999);
      
      message += `• ${safeName}\n`;
      message += `  Categoria: ${safeCategory}\n`;
      message += `  Preço: ${safePrice}\n`;
      message += `  Quantidade: ${safeQuantity}\n`;
      if (item.fragrance?.name) {
        const safeFragrance = sanitize(item.fragrance.name, 50);
        message += `  Fragrância: ${safeFragrance}\n`;
      }
      message += '\n';
    });
    
    message += `📞 Gostaria de finalizar este pedido!`;
    
    // Truncate if message is too long
    if (message.length > MAX_MESSAGE_LENGTH) {
      message = message.substring(0, MAX_MESSAGE_LENGTH - 30) + '\n\n... (mensagem truncada)';
    }
    
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
      updateFragrance,
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
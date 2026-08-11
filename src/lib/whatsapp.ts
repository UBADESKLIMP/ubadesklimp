// wa.me exige o número com código do país; se quem digitou já colocou 55 na
// frente mantemos, senão prefixamos — sem isso o link abre "número inválido".
// Mensagem opcional vai como parâmetro ?text= (mesmo padrão já usado em
// CartContext.tsx, OrderHistory.tsx, Cart.tsx, Hero.tsx e Header.tsx).
export const buildWhatsAppLink = (phone: string, message?: string): string => {
  const digits = phone.replace(/\D/g, '');
  const hasCountryCode = digits.length === 12 || digits.length === 13;
  const withCountryCode = hasCountryCode ? digits : `55${digits}`;
  const base = `https://wa.me/${withCountryCode}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};

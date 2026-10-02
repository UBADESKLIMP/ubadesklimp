// Service worker mínimo: existe para o navegador aceitar instalar o Ponto na
// tela inicial (PRD seção 6). Não guarda nada em cache de propósito — uma
// batida de ponto não pode sair de cache velho, e a tela só funciona dentro da
// rede da loja de qualquer jeito.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // deixa passar direto pra rede
});

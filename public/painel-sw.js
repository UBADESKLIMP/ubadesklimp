// Service worker mínimo: existe só para o navegador aceitar instalar o Painel
// como aplicativo. Não guarda nada em cache: o painel mexe em dinheiro, estoque
// e ponto, então nunca pode mostrar tela velha.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // deixa passar direto pra rede
});

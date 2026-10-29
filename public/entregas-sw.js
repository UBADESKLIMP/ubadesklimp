// Service worker mínimo: só existe para o navegador aceitar instalar o app do
// entregador na tela inicial. Não guarda nada em cache de propósito — a rota do
// dia tem que vir sempre da rede, nunca de uma cópia velha.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // deixa passar direto pra rede
});

import { useEffect, useState } from 'react';

interface EventoDeInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const jaInstalado = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const ehIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/**
 * Deixa a tela do entregador instalável na tela inicial, para ele abrir como um
 * app e não pelo Google. Manifest e service worker entram só em /entregas, por
 * injeção: o resto do site é a loja e não deve virar app de entrega.
 */
export const useEntregasInstalavel = () => {
  const [evento, setEvento] = useState<EventoDeInstalacao | null>(null);
  const [instalado, setInstalado] = useState(false);

  useEffect(() => {
    setInstalado(jaInstalado());

    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/entregas.webmanifest';

    const icone = document.createElement('link');
    icone.rel = 'apple-touch-icon';
    icone.href = '/apple-touch-entregas.png';

    const cor = document.createElement('meta');
    cor.name = 'theme-color';
    cor.content = '#1573D6';

    const titulo = document.createElement('meta');
    titulo.name = 'apple-mobile-web-app-title';
    titulo.content = 'Entregas';

    document.head.append(link, icone, cor, titulo);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/entregas-sw.js', { scope: '/entregas' }).catch(() => {
        // Sem HTTPS ou registro bloqueado: a tela funciona igual, só não instala.
      });
    }

    const aoOferecer = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoDeInstalacao);
    };
    const aoInstalar = () => {
      setEvento(null);
      setInstalado(true);
    };
    window.addEventListener('beforeinstallprompt', aoOferecer);
    window.addEventListener('appinstalled', aoInstalar);

    return () => {
      link.remove();
      icone.remove();
      cor.remove();
      titulo.remove();
      window.removeEventListener('beforeinstallprompt', aoOferecer);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    setEvento(null);
  };

  return {
    /** Android/Chrome: o navegador já deixou instalar com um toque. */
    podeInstalar: !instalado && evento !== null,
    /** iPhone não tem botão de instalar: precisa do passo manual pelo Compartilhar. */
    precisaDeInstrucaoIphone: !instalado && ehIphone(),
    instalar,
  };
};

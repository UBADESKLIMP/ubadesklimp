import { useEffect } from 'react';

/**
 * Deixa o Ponto instalável na tela inicial do celular (PRD seção 6).
 *
 * O manifest e o service worker entram só nas telas de ponto, por injeção:
 * o resto do site é a loja, que tem outro nome, outro ícone e não deve virar
 * aplicativo de bater ponto no celular de ninguém.
 */
export const usePontoInstalavel = () => {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/ponto.webmanifest';
    document.head.appendChild(link);

    const cor = document.createElement('meta');
    cor.name = 'theme-color';
    cor.content = '#0F6B5C';
    document.head.appendChild(cor);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/ponto-sw.js', { scope: '/ponto' }).catch(() => {
        // Sem HTTPS ou com o registro bloqueado: a tela funciona igual, só não
        // dá pra instalar. Não vale incomodar quem está batendo ponto com isso.
      });
    }

    return () => {
      link.remove();
      cor.remove();
    };
  }, []);
};

import { useEffect } from 'react';

/**
 * Deixa o Painel instalável como aplicativo ("Ubadesk Painel"): ao abrir, cai
 * direto no login e depois no painel.
 *
 * Só entra nas telas do painel e no login que leva ao painel, por injeção: o
 * resto do site é a loja e não deve oferecer instalar o painel interno.
 */
export const usePainelInstalavel = (ativo = true) => {
  useEffect(() => {
    if (!ativo) return;

    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/painel.webmanifest';
    document.head.appendChild(link);

    const cor = document.createElement('meta');
    cor.name = 'theme-color';
    cor.content = '#1573D6';
    document.head.appendChild(cor);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/painel-sw.js', { scope: '/' }).catch(() => {
        // Sem HTTPS ou registro bloqueado: a tela funciona igual, só não instala.
      });
    }

    return () => {
      link.remove();
      cor.remove();
    };
  }, [ativo]);
};

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

    // O Chrome em modo app mostra na barra de tarefas o ícone da página: troca o
    // favicon da loja pelo do app, senão Painel e Ponto ficam iguais lá embaixo.
    const antigos = Array.from(document.head.querySelectorAll('link[rel~="icon"]'));
    antigos.forEach((el) => el.remove());
    // Vários tamanhos já reduzidos: o Chrome escolhe o certo para a barra de
    // tarefas em vez de encolher um PNG grande na marra (que fica borrado).
    const icones = [32, 48, 64, 128, 256].map((t) => {
      const el = document.createElement('link');
      el.rel = 'icon';
      el.type = 'image/png';
      el.setAttribute('sizes', `${t}x${t}`);
      el.href = `/painel-icone-${t}.png`;
      document.head.appendChild(el);
      return el;
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/painel-sw.js', { scope: '/' }).catch(() => {
        // Sem HTTPS ou registro bloqueado: a tela funciona igual, só não instala.
      });
    }

    return () => {
      link.remove();
      cor.remove();
      icones.forEach((el) => el.remove());
      antigos.forEach((el) => document.head.appendChild(el));
    };
  }, [ativo]);
};

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
    cor.content = '#0B1020';
    document.head.appendChild(cor);

    // O Chrome em modo app mostra na barra de tarefas o ícone da página: troca o
    // favicon da loja pelo do app, senão Painel e Ponto ficam iguais lá embaixo.
    const antigos = Array.from(document.head.querySelectorAll('link[rel~="icon"]'));
    antigos.forEach((el) => el.remove());
    // Vários tamanhos já reduzidos: o Chrome escolhe o certo para a barra de
    // tarefas em vez de encolher um PNG grande na marra (que fica borrado).
    const icones = [16, 32, 48, 64, 128, 256].map((t) => {
      const el = document.createElement('link');
      el.rel = 'icon';
      el.type = 'image/png';
      el.setAttribute('sizes', `${t}x${t}`);
      el.href = `/ponto-icone-${t}.png`;
      document.head.appendChild(el);
      return el;
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/ponto-sw.js', { scope: '/ponto' }).catch(() => {
        // Sem HTTPS ou com o registro bloqueado: a tela funciona igual, só não
        // dá pra instalar. Não vale incomodar quem está batendo ponto com isso.
      });
    }

    return () => {
      link.remove();
      cor.remove();
      icones.forEach((el) => el.remove());
      antigos.forEach((el) => document.head.appendChild(el));
    };
  }, []);
};

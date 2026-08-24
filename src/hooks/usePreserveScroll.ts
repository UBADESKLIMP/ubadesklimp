import { useEffect, useRef } from 'react';

// Modais de edição cobrem a lista inteira; sem isso, ao fechar o modal
// (salvando ou cancelando) a página volta pro topo em vez de manter a
// posição de onde o usuário estava editando. `isOpen` costuma mudar por
// vários caminhos diferentes (onOpenChange do Dialog, onCancel do form,
// clique num card da lista) — um efeito reagindo à própria flag cobre
// todos eles, ao contrário de tentar interceptar cada callback.
export const usePreserveScroll = (isOpen: boolean) => {
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      scrollYRef.current = window.scrollY;
    } else {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollYRef.current });
      });
    }
  }, [isOpen]);
};

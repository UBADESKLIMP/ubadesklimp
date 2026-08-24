import { useCallback, useEffect, useRef } from 'react';

// Modais de edição cobrem a lista inteira; sem isso, ao fechar o modal
// (salvando ou cancelando) a página volta pro topo em vez de manter a
// posição de onde o usuário estava editando.
//
// A restauração precisa acontecer no onCloseAutoFocus do Radix Dialog, não
// num useEffect genérico: o Radix devolve o foco pro elemento que abriu o
// modal exatamente nesse momento, e focus() por padrão rola a página até
// esse elemento — competindo com (e vencendo) qualquer scrollTo feito antes
// via efeito. Interceptar o próprio evento e cancelar o foco padrão resolve
// na raiz, em vez de tentar vencer uma corrida de timing.
export const usePreserveScroll = (isOpen: boolean) => {
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      scrollYRef.current = window.scrollY;
    }
  }, [isOpen]);

  const onCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    window.scrollTo({ top: scrollYRef.current });
  }, []);

  return { onCloseAutoFocus };
};

import { ReactNode, useLayoutEffect, useRef, useState } from 'react';

/**
 * O quiosque não pode ter barra de rolagem: a pessoa está em pé, de passagem.
 * Cada aba tem um tamanho (título, teclado, lista...) e a janela do PC da loja
 * é baixa, então o conteúdo que passa da altura é encolhido pra caber, centrado.
 * Piso de 70%: abaixo disso fica ilegível, e aí a área rola (caso de lista grande).
 */
const PISO = 0.7;

const AjustaNaTela = ({ children }: { children: ReactNode }) => {
  const fora = useRef<HTMLDivElement>(null);
  const dentro = useRef<HTMLDivElement>(null);
  const [medida, setMedida] = useState({ escala: 1, altura: 0 });

  useLayoutEffect(() => {
    const calcular = () => {
      const f = fora.current;
      const d = dentro.current;
      if (!f || !d) return;
      // offsetHeight não conta o transform: é a altura natural do conteúdo.
      const natural = d.offsetHeight;
      if (!natural) return;
      const escala = Math.max(PISO, Math.min(1, f.clientHeight / natural));
      setMedida((antes) =>
        Math.abs(antes.escala - escala) < 0.002 && Math.abs(antes.altura - natural * escala) < 1
          ? antes
          : { escala, altura: natural * escala }
      );
    };
    calcular();
    const ro = new ResizeObserver(calcular);
    if (fora.current) ro.observe(fora.current);
    if (dentro.current) ro.observe(dentro.current);
    window.addEventListener('resize', calcular);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', calcular);
    };
  }, []);

  return (
    <div ref={fora} className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
      <div className="my-auto" style={{ height: medida.altura || undefined }}>
        <div
          ref={dentro}
          className="flex w-full flex-col"
          style={{ transform: `scale(${medida.escala})`, transformOrigin: 'top center' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default AjustaNaTela;

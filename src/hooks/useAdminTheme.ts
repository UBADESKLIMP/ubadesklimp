import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * Os quatro visuais do painel. "Vidro" usa as cores do claro ou do escuro como
 * base e acrescenta fundo em degradê, cartões translúcidos e barras de vidro.
 */
export type AdminTheme = 'light' | 'dark' | 'glass-dark' | 'glass-light';

export const ADMIN_THEMES: { valor: AdminTheme; rotulo: string }[] = [
  { valor: 'light', rotulo: 'Claro' },
  { valor: 'dark', rotulo: 'Escuro' },
  { valor: 'glass-dark', rotulo: 'Vidro escuro' },
  { valor: 'glass-light', rotulo: 'Vidro claro' },
];

const STORAGE_KEY = 'ubadesklimp-admin-theme';
const CLASSES = ['admin-themed', 'admin-light', 'admin-dark', 'admin-glass', 'admin-glass-dark', 'admin-glass-light'];

const isTheme = (v: unknown): v is AdminTheme => ADMIN_THEMES.some((t) => t.valor === v);

const readStoredTheme = (): AdminTheme => {
  try {
    const salvo = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(salvo) ? salvo : 'light';
  } catch {
    // Navegador com armazenamento bloqueado: segue o tema claro.
    return 'light';
  }
};

// O tema é um só para o painel inteiro (a tela de carregamento, o menu, o
// conteúdo): fica num estado compartilhado, e não dentro de cada componente.
// Antes cada pedaço lia o seu, e a escolha só valia depois que o menu montava.
let atual: AdminTheme = typeof window === 'undefined' ? 'light' : readStoredTheme();
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

const subscribe = (f: () => void) => {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
};

// Escolhido em outra aba do mesmo navegador: esta acompanha.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && isTheme(e.newValue) && e.newValue !== atual) {
      atual = e.newValue;
      avisar();
    }
  });
}

const aplicar = (theme: AdminTheme) => {
  const body = document.body;
  const escuro = theme === 'dark' || theme === 'glass-dark';
  body.classList.remove(...CLASSES);
  body.classList.add('admin-themed', escuro ? 'admin-dark' : 'admin-light');
  if (theme === 'glass-dark' || theme === 'glass-light') {
    body.classList.add('admin-glass', theme === 'glass-dark' ? 'admin-glass-dark' : 'admin-glass-light');
  }
};

// As classes ficam no <body> enquanto o painel está montado (assim janelas e
// menus do Radix, que abrem fora da árvore do painel, também ficam no mesmo
// tema) e saem quando a pessoa volta para o site. Vários componentes pedem o
// tema ao mesmo tempo: só o último a sair limpa.
let emUso = 0;

export const useAdminTheme = () => {
  const theme = useSyncExternalStore(subscribe, () => atual, () => 'light' as AdminTheme);

  useEffect(() => {
    emUso += 1;
    return () => {
      emUso -= 1;
      if (emUso === 0) document.body.classList.remove(...CLASSES);
    };
  }, []);

  useEffect(() => {
    aplicar(theme);
  }, [theme]);

  const setTheme = useCallback((next: AdminTheme) => {
    atual = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // sem armazenamento: o tema vale só nesta visita
    }
    avisar();
  }, []);

  return { theme, setTheme };
};

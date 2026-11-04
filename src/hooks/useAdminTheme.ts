import { useCallback, useEffect, useState } from 'react';

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

// O tema vale só dentro do painel: as classes ficam no <body> enquanto o
// painel está montado (assim janelas e menus do Radix, que abrem fora da
// árvore do painel, também ficam no mesmo tema) e saem quando a pessoa volta
// para o site.
export const useAdminTheme = () => {
  const [theme, setThemeState] = useState<AdminTheme>(readStoredTheme);

  useEffect(() => {
    const body = document.body;
    const escuro = theme === 'dark' || theme === 'glass-dark';
    const vidro = theme === 'glass-dark' || theme === 'glass-light';
    body.classList.add('admin-themed');
    body.classList.remove('admin-light', 'admin-dark', 'admin-glass', 'admin-glass-dark', 'admin-glass-light');
    body.classList.add(escuro ? 'admin-dark' : 'admin-light');
    if (vidro) body.classList.add('admin-glass', theme === 'glass-dark' ? 'admin-glass-dark' : 'admin-glass-light');
    return () => {
      body.classList.remove(
        'admin-themed',
        'admin-light',
        'admin-dark',
        'admin-glass',
        'admin-glass-dark',
        'admin-glass-light'
      );
    };
  }, [theme]);

  const setTheme = useCallback((next: AdminTheme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // sem armazenamento: o tema vale só nesta visita
    }
  }, []);

  return { theme, setTheme };
};

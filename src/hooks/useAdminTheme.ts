import { useCallback, useEffect, useState } from 'react';

export type AdminTheme = 'light' | 'dark';

const STORAGE_KEY = 'ubadesklimp-admin-theme';

const readStoredTheme = (): AdminTheme => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
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
  const [theme, setTheme] = useState<AdminTheme>(readStoredTheme);

  useEffect(() => {
    const body = document.body;
    body.classList.add('admin-themed');
    body.classList.remove('admin-light', 'admin-dark');
    body.classList.add(theme === 'dark' ? 'admin-dark' : 'admin-light');
    return () => {
      body.classList.remove('admin-themed', 'admin-light', 'admin-dark');
    };
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: AdminTheme = current === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // sem armazenamento: o tema vale só nesta visita
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
};

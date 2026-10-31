import { ref, watch } from 'vue';

export type Theme = 'dark' | 'light';

/**
 * Tema claro/oscuro vía `data-theme` en <html>. El canvas no lee CSS, así que el color
 * de la rejilla se copia de la variable --grid cada vez que cambia el tema.
 */
export function useTheme() {
  const theme = ref<Theme>('dark');
  const gridColor = ref('#22222e');

  watch(theme, value => {
    const root = document.documentElement;
    root.dataset.theme = value;
    gridColor.value = getComputedStyle(root).getPropertyValue('--grid').trim() || gridColor.value;
  }, { immediate: true });

  function toggleTheme(): void {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
  }

  return { theme, gridColor, toggleTheme };
}

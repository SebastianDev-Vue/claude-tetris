import { inject, onMounted, onUnmounted, ref, watch, type InjectionKey, type Ref } from 'vue'

export type Theme = 'dark' | 'light'

export interface ThemeContext {
  theme: Ref<Theme>
  /** Modo retro (consola 8-bit): sustituye al tema mientras está activo. */
  retro: Ref<boolean>
  gridColor: Ref<string>
  toggleTheme: () => void
  toggleRetro: () => void
}

export const ThemeKey: InjectionKey<ThemeContext> = Symbol('theme')

export function useThemeContext(): ThemeContext {
  const ctx = inject(ThemeKey)
  if (!ctx) throw new Error('useThemeContext() requiere un useTheme() en un componente padre')
  return ctx
}

/**
 * Tema claro/oscuro vía `data-theme` en <html> y modo retro vía `data-style="retro"`.
 * El canvas no lee CSS, así que el color de la rejilla se copia de la variable --grid cada
 * vez que cambia el tema, y los componentes de canvas leen `retro` para cambiar de dibujo.
 * La tecla R alterna el modo retro en cualquier pantalla.
 */
export function useTheme(): ThemeContext {
  const theme = ref<Theme>('dark')
  const retro = ref(false)
  const gridColor = ref('#22222e')

  watch(
    theme,
    (value) => {
      const root = document.documentElement
      root.dataset.theme = value
      gridColor.value = getComputedStyle(root).getPropertyValue('--grid').trim() || gridColor.value
    },
    { immediate: true },
  )

  watch(
    retro,
    (on) => {
      const root = document.documentElement
      if (on) root.dataset.style = 'retro'
      else delete root.dataset.style
    },
    { immediate: true },
  )

  function toggleTheme(): void {
    if (retro.value) return // en retro el tema no aplica: se recupera al salir
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  function toggleRetro(): void {
    retro.value = !retro.value
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.code === 'KeyR' && !e.repeat) toggleRetro()
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))

  return { theme, retro, gridColor, toggleTheme, toggleRetro }
}

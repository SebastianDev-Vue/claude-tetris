import {
  computed,
  inject,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue'
import { SKINS, type Skin } from '../render/canvas'

export type Theme = 'dark' | 'light'

export interface ThemeContext {
  theme: Ref<Theme>
  /** Skin de los bloques (y del marco, vía `data-skin`); se guarda en localStorage. */
  skin: Ref<Skin>
  /** Skin 8-bit (consola retro): sustituye al tema mientras está activa. */
  retro: ComputedRef<boolean>
  /** El tema claro/oscuro no aplica con las skins 8-bit y neón. */
  themeLocked: ComputedRef<boolean>
  gridColor: Ref<string>
  toggleTheme: () => void
  setSkin: (value: Skin) => void
  cycleSkin: () => void
}

export const ThemeKey: InjectionKey<ThemeContext> = Symbol('theme')

export const SKIN_STORAGE_KEY = 'tetris-skin'

export function useThemeContext(): ThemeContext {
  const ctx = inject(ThemeKey)
  if (!ctx) throw new Error('useThemeContext() requiere un useTheme() en un componente padre')
  return ctx
}

function loadSkin(): Skin {
  try {
    const stored = localStorage.getItem(SKIN_STORAGE_KEY)
    return SKINS.find((s) => s === stored) ?? 'retro'
  } catch {
    return 'retro' // almacenamiento bloqueado (modo privado, permisos...)
  }
}

/**
 * Tema claro/oscuro vía `data-theme` en <html> y skin vía `data-skin` (la 8-bit además
 * pone `data-style="retro"`). El canvas no lee CSS, así que el color de la rejilla se copia
 * de la variable --grid cada vez que cambia el tema o la skin, y los componentes de canvas
 * leen `skin` en cada frame. La tecla R pasa a la siguiente skin en cualquier pantalla.
 */
export function useTheme(): ThemeContext {
  const theme = ref<Theme>('dark')
  const skin = ref<Skin>(loadSkin())
  const retro = computed(() => skin.value === '8bit')
  const themeLocked = computed(() => skin.value === '8bit' || skin.value === 'neon')
  const gridColor = ref('#22222e')

  watch(
    [theme, skin],
    ([themeValue, skinValue]) => {
      const root = document.documentElement
      root.dataset.theme = themeValue
      root.dataset.skin = skinValue
      if (skinValue === '8bit') root.dataset.style = 'retro'
      else delete root.dataset.style
      gridColor.value = getComputedStyle(root).getPropertyValue('--grid').trim() || gridColor.value
    },
    { immediate: true },
  )

  watch(skin, (value) => {
    try {
      localStorage.setItem(SKIN_STORAGE_KEY, value)
    } catch {
      // sin almacenamiento la skin solo dura esta sesión
    }
  })

  function toggleTheme(): void {
    if (themeLocked.value) return // el tema no aplica: se recupera al cambiar de skin
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  function setSkin(value: Skin): void {
    skin.value = value
  }

  function cycleSkin(): void {
    skin.value = SKINS[(SKINS.indexOf(skin.value) + 1) % SKINS.length]!
  }

  function onKeydown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null
    if (target?.closest?.('input, textarea, select')) return // escribiendo en un campo
    if (e.code === 'KeyR' && !e.repeat) cycleSkin()
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))

  return { theme, skin, retro, themeLocked, gridColor, toggleTheme, setSkin, cycleSkin }
}

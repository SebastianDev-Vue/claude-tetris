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

export interface ThemeContext {
  /** Skin de los bloques (y del marco, vía `data-skin`); se guarda en localStorage. */
  skin: Ref<Skin>
  /** Skin 8-bit (consola retro). */
  retro: ComputedRef<boolean>
  gridColor: Ref<string>
  setSkin: (value: Skin) => void
  cycleSkin: () => void
}

/** El foco está en un campo de texto: los atajos globales no deben reaccionar al escribir. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select') !== null)
  )
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
 * Skin vía `data-skin` en <html> (la 8-bit además
 * pone `data-style="retro"`). El canvas no lee CSS, así que el color de la rejilla se copia
 * de la variable --grid cada vez que cambia la skin, y los componentes de canvas
 * leen `skin` en cada frame. La tecla R pasa a la siguiente skin en cualquier pantalla.
 */
export function useTheme(): ThemeContext {
  const skin = ref<Skin>(loadSkin())
  const retro = computed(() => skin.value === '8bit')
  const gridColor = ref('#22222e')

  watch(
    skin,
    (skinValue) => {
      const root = document.documentElement
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

  function setSkin(value: Skin): void {
    skin.value = value
  }

  function cycleSkin(): void {
    skin.value = SKINS[(SKINS.indexOf(skin.value) + 1) % SKINS.length]!
  }

  function onKeydown(e: KeyboardEvent): void {
    if (isTypingTarget(e.target)) return
    if (e.code === 'KeyR' && !e.repeat) cycleSkin()
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))

  return { skin, retro, gridColor, setSkin, cycleSkin }
}

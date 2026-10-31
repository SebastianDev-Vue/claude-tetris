import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { SKIN_STORAGE_KEY, useTheme, type ThemeContext } from '@/composables/useTheme'

let wrapper: VueWrapper | undefined

/** Monta un componente mínimo que usa useTheme() y devuelve su contexto. */
function mountTheme(): ThemeContext {
  let ctx: ThemeContext | undefined
  wrapper = mount(
    defineComponent({
      setup() {
        ctx = useTheme()
        return () => null
      },
    }),
  )
  return ctx!
}

const pressR = (repeat = false) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', repeat }))

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  localStorage.clear()
  vi.restoreAllMocks()
  delete document.documentElement.dataset.style
  delete document.documentElement.dataset.skin
})

describe('useTheme: skins', () => {
  it('empieza en retro y la tecla R pasa por todas las skins en orden', async () => {
    const { skin } = mountTheme()
    expect(skin.value).toBe('retro')
    const seen: string[] = []
    for (let i = 0; i < 5; i++) {
      pressR()
      seen.push(skin.value)
    }
    expect(seen).toEqual(['neon', 'pastel', 'pixel', '8bit', 'retro'])
    await nextTick()
    expect(document.documentElement.dataset.skin).toBe('retro')
  })

  it('la skin 8-bit pone data-style="retro" en <html> y lo quita al salir', async () => {
    const { retro, setSkin } = mountTheme()
    setSkin('8bit')
    await nextTick()
    expect(retro.value).toBe(true)
    expect(document.documentElement.dataset.style).toBe('retro')
    setSkin('pastel')
    await nextTick()
    expect(document.documentElement.dataset.style).toBeUndefined()
    expect(document.documentElement.dataset.skin).toBe('pastel')
  })

  it('mantener R pulsada no avanza una y otra vez', () => {
    const { skin } = mountTheme()
    pressR()
    pressR(true)
    pressR(true)
    expect(skin.value).toBe('neon')
  })

  it('R escrita en un campo de texto no cambia la skin', () => {
    const { skin } = mountTheme()
    const input = document.createElement('input')
    document.body.append(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }))
    input.remove()
    expect(skin.value).toBe('retro')
  })

  it('guarda la skin en localStorage y la recupera al volver', async () => {
    const { setSkin } = mountTheme()
    setSkin('pixel')
    await nextTick()
    expect(localStorage.getItem(SKIN_STORAGE_KEY)).toBe('pixel')
    wrapper?.unmount()
    expect(mountTheme().skin.value).toBe('pixel')
  })

  it('un valor guardado desconocido vuelve a retro', () => {
    localStorage.setItem(SKIN_STORAGE_KEY, 'arcoiris')
    expect(mountTheme().skin.value).toBe('retro')
  })

  it('sin almacenamiento disponible sigue funcionando', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    const { skin, cycleSkin } = mountTheme()
    expect(skin.value).toBe('retro')
    cycleSkin()
    await nextTick()
    expect(skin.value).toBe('neon')
  })

  it('en 8-bit y neón el tema claro/oscuro no cambia y se conserva al salir', () => {
    const { theme, toggleTheme, setSkin } = mountTheme()
    setSkin('8bit')
    toggleTheme()
    setSkin('neon')
    toggleTheme()
    expect(theme.value).toBe('dark')
    setSkin('pastel')
    toggleTheme()
    expect(theme.value).toBe('light')
  })

  it('escribir R en un campo de texto no alterna el modo retro', () => {
    const { retro } = mountTheme()
    const input = document.body.appendChild(document.createElement('input'))
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }))
    input.remove()
    expect(retro.value).toBe(false)
  })

  it('al desmontar deja de escuchar el teclado (HMR)', () => {
    const { skin } = mountTheme()
    wrapper?.unmount()
    wrapper = undefined
    pressR()
    expect(skin.value).toBe('retro')
  })
})

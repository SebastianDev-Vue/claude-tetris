import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { useTheme, type ThemeContext } from '@/composables/useTheme'

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
  delete document.documentElement.dataset.style
})

describe('useTheme: modo retro', () => {
  it('la tecla R alterna data-style="retro" en <html>', async () => {
    const { retro } = mountTheme()
    pressR()
    await nextTick()
    expect(retro.value).toBe(true)
    expect(document.documentElement.dataset.style).toBe('retro')
    pressR()
    await nextTick()
    expect(document.documentElement.dataset.style).toBeUndefined()
  })

  it('mantener R pulsada no lo alterna una y otra vez', () => {
    const { retro } = mountTheme()
    pressR()
    pressR(true)
    pressR(true)
    expect(retro.value).toBe(true)
  })

  it('en retro el tema claro/oscuro no cambia y se conserva al salir', () => {
    const { theme, toggleTheme, toggleRetro } = mountTheme()
    toggleRetro()
    toggleTheme()
    expect(theme.value).toBe('dark')
    toggleRetro()
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
    const { retro } = mountTheme()
    wrapper?.unmount()
    wrapper = undefined
    pressR()
    expect(retro.value).toBe(false)
  })
})

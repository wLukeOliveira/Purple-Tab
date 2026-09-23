import { useEffect, type RefObject } from 'react'

/** Frame-limited pointer light: styling only, no React renders while moving. */
export function useSurfaceLight(root: RefObject<HTMLDivElement | null>, ready: boolean) {
  useEffect(() => {
    const container = root.current
    if (!ready || !container) return
    let active: HTMLElement | null = null
    let frame = 0
    let x = 0
    let y = 0
    const clear = () => {
      active?.style.setProperty('--light-on', '0')
      active = null
      cancelAnimationFrame(frame)
      frame = 0
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const target = (event.target as HTMLElement).closest<HTMLElement>('.primary, .stat-card, .creation-tile, .forecast-card, .account-summary')
      if (target !== active) {
        clear()
        active = target
        active?.style.setProperty('--light-on', '1')
      }
      if (!active) return
      const bounds = active.getBoundingClientRect()
      x = event.clientX - bounds.left
      y = event.clientY - bounds.top
      if (!frame) frame = requestAnimationFrame(() => {
        active?.style.setProperty('--light-x', `${x}px`)
        active?.style.setProperty('--light-y', `${y}px`)
        frame = 0
      })
    }
    container.addEventListener('pointermove', move)
    container.addEventListener('pointerleave', clear)
    return () => {
      container.removeEventListener('pointermove', move)
      container.removeEventListener('pointerleave', clear)
      clear()
    }
  }, [root, ready])
}

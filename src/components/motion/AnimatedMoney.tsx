import { useLayoutEffect, useRef } from 'react'
import { money } from '../../lib/finance'
import { useCurrency } from '../../lib/CurrencyContext'
import './motion.css'

interface Props { cents: number; className?: string; duration?: number; currency?: string }

/** Interpolates presentation only; the canonical value remains integer cents. */
export default function AnimatedMoney({ cents, className = '', duration = 820, currency: explicitCurrency }: Props) {
  const inheritedCurrency = useCurrency()
  const currency = explicitCurrency || inheritedCurrency
  const root = useRef<HTMLSpanElement>(null)
  const visual = useRef<HTMLSpanElement>(null)
  const visibleCents = useRef(cents)
  const label = money(cents, currency)

  useLayoutEffect(() => {
    const element = visual.current
    const container = root.current
    if (!element || !container) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let stopped = false
    const finish = () => {
      cancelAnimationFrame(frame)
      visibleCents.current = cents
      element.textContent = money(cents, currency)
      delete container.dataset.animating
    }
    const onPreferenceChange = () => { if (preference.matches) finish() }
    preference.addEventListener('change', onPreferenceChange)
    const from = visibleCents.current
    if (preference.matches || from === cents || duration <= 0) finish()
    else {
      // Restore the visible value before paint; interrupted motion continues
      // from this point rather than jumping back to the previous target.
      element.textContent = money(from, currency)
      container.dataset.animating = 'true'
      const start = performance.now()
      const animate = (time: number) => {
        if (stopped) return
        const progress = Math.max(0, Math.min(1, (time - start) / duration))
        if (progress >= 1) { finish(); return }
        const eased = 1 - Math.pow(1 - progress, 3)
        visibleCents.current = Math.round(from * (1 - eased) + cents * eased)
        element.textContent = money(visibleCents.current, currency)
        frame = requestAnimationFrame(animate)
      }
      frame = requestAnimationFrame(animate)
    }
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      preference.removeEventListener('change', onPreferenceChange)
    }
  }, [cents, duration, currency])

  // Screen readers receive the exact amount, never the transient frames.
  return <span ref={root} className={`motion-number ${className}`} data-value={cents}>
    <span ref={visual} className="motion-number-visual" aria-hidden="true">{label}</span>
    <span className="motion-number-accessible">{label}</span>
  </span>
}

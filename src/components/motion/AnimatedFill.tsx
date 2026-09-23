import { useLayoutEffect, useRef } from 'react'
import './motion.css'

interface Props { percentage: number; className?: string }

export default function AnimatedFill({ percentage, className = '' }: Props) {
  const element = useRef<HTMLSpanElement>(null)
  const mounted = useRef(false)
  useLayoutEffect(() => {
    const fill = element.current
    if (!fill) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const target = `scaleX(${Math.max(0, Math.min(100, percentage)) / 100})`
    let frame = 0
    const apply = () => { fill.style.transform = target; mounted.current = true }
    const onPreferenceChange = () => { if (preference.matches) { cancelAnimationFrame(frame); apply() } }
    preference.addEventListener('change', onPreferenceChange)
    if (preference.matches || mounted.current) apply()
    else frame = requestAnimationFrame(() => { frame = requestAnimationFrame(apply) })
    return () => { cancelAnimationFrame(frame); preference.removeEventListener('change', onPreferenceChange) }
  }, [percentage])
  return <span ref={element} className={`motion-fill ${className}`} style={{ transform: 'scaleX(0)' }} aria-hidden="true" />
}

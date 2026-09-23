import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export default function QuickCreateDialog({ title, onClose, busy, wide = false, children }: { title: string; onClose: () => void; busy: boolean; wide?: boolean; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    element.querySelector<HTMLElement>('input:not([disabled])')?.focus()
    return () => { if (element.open) element.close() }
  }, [])

  return createPortal(<dialog ref={dialog} className={`quick-create-dialog ${wide ? 'is-wide' : ''}`} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose() }} onClick={event => { if (event.target === dialog.current && !busy) onClose() }}>
    {children}
  </dialog>, document.body)
}

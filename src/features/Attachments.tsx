import { useState } from 'react'
import { Paperclip, Download, Trash2 } from 'lucide-react'
import type { Commit, Snapshot } from '../lib/types'
import { api } from '../lib/api'

export default function Attachments({ snapshot, ownerType, ownerId, onCommit }: { snapshot: Snapshot; ownerType: 'bill' | 'loan' | 'property'; ownerId: string; onCommit: Commit }) {
  const [deleting, setDeleting] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const run = async (action: () => Promise<unknown>, message: string) => { if (busy) return; setBusy(true); const ok = await onCommit(action, message); setBusy(false); if (ok) setDeleting(null) }
  return <div className="attachment-list"><div className="section-heading"><span className="hint">Documentos locais · incluídos no backup</span><button type="button" className="text-button" disabled={busy} onClick={() => void run(() => api.importAttachment({ ownerType, ownerId }), 'Anexo salvo no banco local.')}><Paperclip size={14} />Anexar PDF / imagem</button></div>{snapshot.attachments?.filter(a => a.ownerType === ownerType && a.ownerId === ownerId).map(a => <div className="attachment-row" key={a.id}><span>{a.name}<small>{Math.ceil(a.size / 1024)} KB</small></span><button type="button" className="icon-button" title="Salvar cópia" aria-label={`Salvar cópia de ${a.name}`} disabled={busy} onClick={() => void run(() => api.exportAttachment({ id: a.id }), 'Cópia salva.')}><Download size={14} /></button>{deleting === a.id ? <><button type="button" className="danger" disabled={busy} onClick={() => void run(() => api.deleteAttachment({ id: a.id }), 'Anexo removido. O arquivo original não foi alterado.')}>Remover anexo</button><button type="button" className="text-button" onClick={() => setDeleting(null)}>Cancelar</button></> : <button type="button" className="icon-button" aria-label={`Remover ${a.name}`} onClick={() => setDeleting(a.id)}><Trash2 size={14} /></button>}</div>)}</div>
}

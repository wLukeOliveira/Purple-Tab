import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import electron from 'electron'

const server = await createServer()
await server.listen()
server.printUrls()
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(electron, ['.', '--dev'], { stdio: 'inherit', env })
let closing = false
async function stop(code = 0) {
  if (closing) return
  closing = true
  child.kill()
  await server.close()
  process.exit(code)
}
child.on('exit', code => stop(code || 0))
child.on('error', error => { console.error(error); stop(1) })
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, renameSync, existsSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
function run(script, args = []) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...args], { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
run('node_modules/typescript/bin/tsc', ['-b'])
run('node_modules/vite/bin/vite.js', ['build'])
if (process.argv[2] === 'package') {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Gere este pacote no Windows x64.')
  const packageVersion = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version
  if (!/^\d+\.\d+\.\d+$/.test(packageVersion)) throw new Error('Versão inválida para empacotamento.')
  const output = path.join(root, 'release', `Purple Tab-${packageVersion}-win32-x64`)
  const appDir = path.join(output, 'resources', 'app')
  mkdirSync(output, { recursive: true })
  cpSync(path.join(root, 'node_modules', 'electron', 'dist'), output, { recursive: true })
  const renamed = path.join(output, 'Purple Tab.exe')
  if (existsSync(renamed)) unlinkSync(renamed)
  renameSync(path.join(output, 'electron.exe'), renamed)
  const defaultApp = path.join(output, 'resources', 'default_app.asar')
  if (existsSync(defaultApp)) unlinkSync(defaultApp)
  mkdirSync(appDir, { recursive: true })
  for (const entry of ['dist', 'electron', 'preload.cjs']) cpSync(path.join(root, entry), path.join(appDir, entry), { recursive: true })
  const licenses=path.join(output,'licenses')
  mkdirSync(licenses,{recursive:true})
  for(const [name,file] of [['Nunito-Sans','@fontsource/nunito-sans/LICENSE'],['Cryptocurrency-Icons','cryptocurrency-icons/LICENSE.md'],['Lightweight-Charts','lightweight-charts/LICENSE']]) cpSync(path.join(root,'node_modules',file),path.join(licenses,`${name}.txt`))
  const source = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({ name: source.name, productName: 'Purple Tab', version: source.version, type: 'module', main: source.main }, null, 2))
  writeFileSync(path.join(output, 'LEIA-ME.txt'), 'PURPLE TAB\r\n\r\nAbra Purple Tab.exe. Mantenha os arquivos desta pasta juntos.\r\nO aplicativo funciona sem Node, terminal ou internet.\r\nOs dados ficam em %APPDATA%\\Purple Tab, separados desta pasta.\r\nUse Configuracoes > Salvar backup para guardar uma copia dos dados em outro local.\r\n')
  console.log(`\nExecutável Windows: ${renamed}`)
}

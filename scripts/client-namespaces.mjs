// Elenca i testi (namespace di messages/*.json) usati dai componenti con
// useTranslations: solo questi vanno al browser (layout principale). Gira da
// solo prima di `next dev` e `next build`, così l'elenco non resta indietro.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const files = []
;(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.tsx?$/.test(name)) files.push(p)
  }
})('src')

const namespaces = new Set()
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(/useTranslations\(\s*['"]([^'".]+)/g)) namespaces.add(m[1])
  if (/useTranslations\(\s*\)|useMessages\(/.test(text)) {
    console.error(`[client-namespaces] ${file}: useTranslations() senza namespace o useMessages(): servono tutti i testi`)
    process.exit(1)
  }
}

const list = [...namespaces].sort()
writeFileSync(
  'src/i18n/clientNamespaces.generated.ts',
  `// File generato da scripts/client-namespaces.mjs: non modificare a mano.\n// Testi usati dai componenti con useTranslations (vanno al browser).\nexport const CLIENT_NAMESPACES: readonly string[] = ${JSON.stringify(list, null, 2)}\n`
)
console.log(`[client-namespaces] ${list.length} namespace`)

// Elenchi per Verifica IBAN: banche (ABI) e sportelli (ABI + CAB) dal
// registro pubblico della Banca d'Italia (GIAVA, licenza CC-BY 4.0).
//
// 1. Scarica da infostat.bancaditalia.it (Open Data → «Lista intermediari»
//    e «Succursali delle banche») i due ZIP e decomprimili.
// 2. node scripts/bank-registry.mjs <INTERMEDIARI.csv> <SUCCURSALI_BANCHE.csv>
// Scrive src/data/banks-it.json e src/data/bank-branches-it.json.
import fs from 'fs'

const [intermediari, succursali] = process.argv.slice(2)
if (!intermediari || !succursali) {
  console.error('Uso: node scripts/bank-registry.mjs <INTERMEDIARI.csv> <SUCCURSALI_BANCHE.csv>')
  process.exit(1)
}
const OPEN = '9999-12-31'
const read = (file) =>
  fs
    .readFileSync(file, 'utf8')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map((line) => line.split(';').map((v) => v.trim()))
const abi5 = (code) => code.replace(/\D/g, '').padStart(5, '0')
const tidy = (s) => s.replace(/\s+/g, ' ').trim()

// Albi che hanno un codice ABI e conti con IBAN
const KIND = [
  [/^ALBO DELLE BANCHE$/, 'bank'],
  [/^ALBO IP ART\.114-SEPTIES TUB$/, 'ip'],
  [/^ALBO IMEL/, 'imel'],
]
const kindOf = (albo) => KIND.find(([re]) => re.test(albo))?.[1] ?? null

// Sportelli attivi: nome attuale della banca e indirizzo per ABI + CAB
const branches = new Map()
const currentName = new Map()
for (const r of read(succursali)) {
  const [, name, abi, , cab, , , , endOper, , , address, cap, , , city, , , , , , , , endVal] = r
  if (endOper !== OPEN || endVal !== OPEN || !abi || !cab) continue
  const a = abi5(abi)
  currentName.set(a, tidy(name))
  const key = `${a}-${cab.padStart(5, '0')}`
  const value = `${tidy(address)}|${cap}|${tidy(city)}`
  // Più sportelli con lo stesso ABI + CAB: resta solo il comune, se è lo stesso
  if (branches.has(key)) {
    const prev = branches.get(key)
    const prevCity = prev ? prev.split('|')[2] : null
    branches.set(key, prevCity && prevCity === tidy(city) ? `||${prevCity}` : null)
  } else branches.set(key, value)
}

// Intermediari iscritti oggi (banche, istituti di pagamento, moneta elettronica)
const banks = {}
const latest = new Map()
for (const r of read(intermediari)) {
  const abi = r[1]
  const albo = r[3]
  const closed = r[5]
  // Iscrizione ancora valida (cancellazione e fine validità «aperte»)
  const cancelled = r[8] !== OPEN
  const name = r[13]
  const validFrom = r[r.length - 2] ?? ''
  const validTo = r[r.length - 1] ?? ''
  const kind = kindOf(albo)
  if (!abi || !kind || closed !== OPEN || cancelled || validTo !== OPEN) continue
  const a = abi5(abi)
  const prev = latest.get(a)
  if (!prev || validFrom > prev.validFrom) latest.set(a, { name: tidy(name), kind, validFrom })
}
for (const [a, { name, kind }] of latest) banks[a] = [currentName.get(a) ?? name, kind]
// Banche con sportelli ma senza riga attuale nell'albo letto sopra
for (const [a, name] of currentName) if (!banks[a]) banks[a] = [name, 'bank']
// Poste Italiane (BancoPosta): non è nell'albo delle banche
banks['07601'] = ['POSTE ITALIANE S.P.A. – BANCOPOSTA', 'poste']

const branchOut = Object.fromEntries([...branches].filter(([, v]) => v))
fs.mkdirSync('src/data', { recursive: true })
fs.writeFileSync('src/data/banks-it.json', JSON.stringify(banks))
fs.writeFileSync('src/data/bank-branches-it.json', JSON.stringify(branchOut))
console.log(`banche/istituti: ${Object.keys(banks).length} · sportelli: ${Object.keys(branchOut).length}`)

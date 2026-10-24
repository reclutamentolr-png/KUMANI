import type { Drawing, DrawingLevel } from './types'
import orsetto from './drawings/orsetto'
import coniglietto from './drawings/coniglietto'
import pulcino from './drawings/pulcino'
import gattino from './drawings/gattino'
import cagnolino from './drawings/cagnolino'
import elefante from './drawings/elefante'
import leone from './drawings/leone'
import gufo from './drawings/gufo'
import farfalla from './drawings/farfalla'
import pesciolino from './drawings/pesciolino'
import tartaruga from './drawings/tartaruga'
import balena from './drawings/balena'
import unicorno from './drawings/unicorno'
import macchinina from './drawings/macchinina'
import razzo from './drawings/razzo'
import trenino from './drawings/trenino'
import mongolfiera from './drawings/mongolfiera'
import dinosauro from './drawings/dinosauro'
import pinguino from './drawings/pinguino'

// Tutti i disegni dell'Angolo Bambini (per aggiungerne uno: il file in
// drawings/, l'import qui, il nome in messages → kids.drawings e i nomi delle
// parti nuove in kids.parts)
export const DRAWINGS: Drawing[] = [
  orsetto, coniglietto, pulcino, gattino, cagnolino, elefante, leone, gufo, farfalla, pesciolino,
  tartaruga, balena, unicorno, macchinina, razzo, trenino, mongolfiera, dinosauro, pinguino,
]

export const drawingById = (id: string) => DRAWINGS.find((d) => d.id === id) ?? null

export type ChildGender = 'boy' | 'girl'

// Livello giusto per l'età: i più piccoli hanno soprattutto disegni con poche
// parti grandi, i più grandi soprattutto quelli con più dettagli (ma tutti i
// livelli restano possibili)
const LEVEL_FIT: Record<'small' | 'middle' | 'big', Record<DrawingLevel, number>> = {
  small: { 1: 4, 2: 1, 3: 0.25 },
  middle: { 1: 1.2, 2: 3, 3: 1 },
  big: { 1: 0.5, 2: 1.5, 3: 3 },
}
export const ageBand = (age: number) => (age <= 4 ? 'small' : age <= 6 ? 'middle' : 'big')

// Disegno a caso per il bambino: età e bambino/bambina cambiano la
// probabilità, non escludono nulla; mai uno degli ultimi giocati, e i disegni
// non ancora completati escono più spesso
export function pickDrawing(opts: { age: number; gender: ChildGender; recent: string[]; done: string[] }, random = Math.random): Drawing {
  const fit = LEVEL_FIT[ageBand(opts.age)]
  const recent = new Set(opts.recent.slice(-3))
  const done = new Set(opts.done)
  const pool = DRAWINGS.filter((d) => !recent.has(d.id))
  const list = pool.length ? pool : DRAWINGS
  const weights = list.map((d) => fit[d.level] * d.weight[opts.gender] * (done.has(d.id) ? 1 : 1.5))
  let r = random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < list.length; i++) {
    r -= weights[i]
    if (r <= 0) return list[i]
  }
  return list[list.length - 1]
}

// Pastelli: tondi, tanti quanti l'età riesce a gestire
export const PALETTE = [
  { key: 'red', hex: '#E8473B' },
  { key: 'orange', hex: '#F28C28' },
  { key: 'yellow', hex: '#F7C531' },
  { key: 'green', hex: '#5DB14E' },
  { key: 'lightBlue', hex: '#7CC3EE' },
  { key: 'blue', hex: '#3A5BC7' },
  { key: 'purple', hex: '#8E5CC4' },
  { key: 'pink', hex: '#F49CBB' },
  { key: 'brown', hex: '#9A6234' },
  { key: 'hazel', hex: '#D9A86C' },
  { key: 'beige', hex: '#F1D9B5' },
  { key: 'gray', hex: '#A9ABBE' },
  { key: 'darkGreen', hex: '#2E7D4F' },
  { key: 'turquoise', hex: '#2BB5B0' },
  { key: 'lilac', hex: '#C9B3EC' },
  { key: 'black', hex: '#3B3A4A' },
] as const
export type PaletteKey = (typeof PALETTE)[number]['key']
export const ERASER = '#FFFFFF'

export function paletteFor(age: number) {
  const band = ageBand(age)
  const keys: PaletteKey[] =
    band === 'small'
      ? ['red', 'orange', 'yellow', 'green', 'lightBlue', 'purple', 'pink', 'brown']
      : band === 'middle'
        ? ['red', 'orange', 'yellow', 'green', 'lightBlue', 'blue', 'purple', 'pink', 'brown', 'beige', 'gray', 'black']
        : PALETTE.map((c) => c.key)
  return PALETTE.filter((c) => keys.includes(c.key))
}

// Note di una scala allegra (pentatonica): ogni pastello ha il suo suono
export const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093, 2349.32, 2637.02, 3135.96, 3520, 392]

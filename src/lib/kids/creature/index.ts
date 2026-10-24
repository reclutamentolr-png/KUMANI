import type { Drawing } from '../types'
import { ARMS, BODIES, FEET } from './bodies'
import { TAILS, WINGS } from './extras'
import { HEADS, TOPS } from './heads'
import { SLOTS, type CreaturePart, type Slot } from './types'

export const CREATURE_PARTS: Record<Slot, CreaturePart[]> = {
  ali: WINGS,
  coda: TAILS,
  braccia: ARMS,
  corpo: BODIES,
  piedi: FEET,
  sopra: TOPS,
  testa: HEADS,
}

export type CreatureSelection = Record<Slot, string | null>

// Prato con sole e nuvola, uguale per tutte le creature
const SCENE = `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<g data-role="sun" data-o="338 52"><path class="f" data-r="raggi" d="M368 46 L384 52 L368 58 Z M360 74 L367 89 L352 82 Z M344 82 L338 98 L332 82 Z M324 74 L309 89 L316 74 Z M308 58 L292 52 L308 46 Z M316 30 L309 15 L324 22 Z M332 22 L338 6 L344 22 Z M352 22 L367 15 L360 30 Z"/></g>
<circle class="f" data-r="sole" cx="338" cy="52" r="26"/>
<g data-role="cloud"><path class="f" data-r="nuvola" d="M40 92 A15 15 0 0 1 48 64 A22 22 0 0 1 88 58 A16 16 0 0 1 114 76 A13 13 0 0 1 110 92 Z"/></g>
<path class="f" data-r="prato" d="M2 398 Q110 366 210 392 T398 384 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>`

const ZZZ = `<text data-role="zzz" x="286" y="88">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>`

export const firstSelection = (): CreatureSelection =>
  Object.fromEntries(SLOTS.map((s) => [s, CREATURE_PARTS[s][0]?.id ?? null])) as CreatureSelection

const partSvg = (slot: Slot, sel: CreatureSelection) => (sel[slot] ? (CREATURE_PARTS[slot].find((p) => p.id === sel[slot])?.svg ?? '') : '')

// Monta la creatura: stesso formato dei disegni da colorare e animare
export function assembleCreature(sel: CreatureSelection): Drawing {
  const body = ['ali', 'coda', 'braccia', 'corpo', 'piedi'].map((s) => partSvg(s as Slot, sel)).join('')
  const head = `<g data-role="head" data-o="200 228">${partSvg('sopra', sel)}${partSvg('testa', sel)}</g>`
  const figureSvg = body + head
  const figure = [...new Set([...figureSvg.matchAll(/data-r="([^"]+)"/g)].map((m) => m[1]))]
  return {
    id: 'creatura',
    category: 'fantasia',
    level: 2,
    weight: { boy: 1, girl: 1 },
    figure,
    svg: `${SCENE}<g data-role="figure" data-o="200 414">${figureSvg}${ZZZ}</g>`,
  }
}

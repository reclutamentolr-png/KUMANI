// Angolo Bambini: movimenti preparati, uguali per tutti i disegni. Ogni gruppo
// con data-role si muove intorno al suo perno (data-o, applicato dal gioco
// come transform-origin). Lo stato sta sull'<svg>: .asleep (dorme), .alive
// (sveglio) e .mode-<movimento>. Niente IA: solo CSS.

export const MOVES = ['saluta', 'balla', 'salta', 'nanna'] as const
export type Move = (typeof MOVES)[number]

export const KIDS_SVG_CSS = `
.kids-svg { -webkit-tap-highlight-color: transparent; user-select: none; }
.kids-svg .f { fill: #FFFFFF; stroke: #2B2D52; stroke-width: 4; stroke-linejoin: round; stroke-linecap: round; cursor: pointer; transition: fill .25s ease; }
.kids-svg .f.flash { animation: kflash .45s ease; }
.kids-svg .ink { fill: #2B2D52; pointer-events: none; }
.kids-svg .hl { fill: #FFFFFF; pointer-events: none; }
.kids-svg .stroke { fill: none; stroke: #2B2D52; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
.kids-svg [data-role] { transform-box: view-box; }
.kids-svg [data-role="zzz"] { font-family: "Baloo 2", "Arial Rounded MT Bold", system-ui, sans-serif; font-weight: 800; font-size: 30px; fill: #2B2D52; opacity: 0; pointer-events: none; }
.kids-svg [data-role="eyes"] { transition: transform .3s ease; }
.kids-svg [data-role="armL"], .kids-svg [data-role="armR"], .kids-svg [data-role="head"] { transition: transform .4s ease; }

.kids-svg.asleep [data-role="eyes"], .kids-svg.mode-nanna [data-role="eyes"] { transform: scaleY(0.12); }
.kids-svg.asleep [data-role="zzz"], .kids-svg.mode-nanna [data-role="zzz"] { animation: kzzz 3s ease-in-out infinite; }

.kids-svg.alive:not(.mode-nanna) [data-role="eyes"] { animation: kblink 4.2s infinite; }
.kids-svg.alive [data-role="sun"] { animation: kspin 16s linear infinite; }
.kids-svg.alive [data-role="cloud"] { animation: kdrift 5s ease-in-out infinite alternate; }
.kids-svg.alive [data-role="plant"] { animation: kplant 2.4s ease-in-out infinite alternate; }
.kids-svg.alive [data-role="plant"]:nth-of-type(even) { animation-direction: alternate-reverse; animation-duration: 2.8s; }
.kids-svg.alive [data-role="water"] { animation: kbob 2.2s ease-in-out infinite alternate; }
.kids-svg.alive [data-role="wheel"] { animation: kspin 1.2s linear infinite; }
.kids-svg.alive [data-role="flame"] { animation: kflame .35s ease-in-out infinite alternate; }
.kids-svg.alive [data-role="tail"] { animation: kwag 1.6s ease-in-out infinite alternate; }

.kids-svg.mode-saluta [data-role="armR"] { animation: kwave 1.1s ease-in-out infinite; }
.kids-svg.mode-saluta [data-role="head"] { animation: ktilt 2.4s ease-in-out infinite alternate; }
.kids-svg.mode-saluta [data-role="tail"] { animation: kwag .35s ease-in-out infinite alternate; }
.kids-svg.mode-saluta [data-role="wingL"] { animation: kflapL .5s ease-in-out infinite alternate; }
.kids-svg.mode-saluta [data-role="wingR"] { animation: kflapR .5s ease-in-out infinite alternate; }
.kids-svg.mode-saluta [data-role="ears"] { animation: kears .6s ease-in-out infinite alternate; }

.kids-svg.mode-balla [data-role="figure"] { animation: ksway .8s ease-in-out infinite alternate; }
.kids-svg.mode-balla [data-role="armL"] { animation: kdanceL .8s ease-in-out infinite alternate; }
.kids-svg.mode-balla [data-role="armR"] { animation: kdanceR .8s ease-in-out infinite alternate; }
.kids-svg.mode-balla [data-role="head"] { animation: ktilt .8s ease-in-out infinite alternate-reverse; }
.kids-svg.mode-balla [data-role="wingL"] { animation: kflapL .4s ease-in-out infinite alternate; }
.kids-svg.mode-balla [data-role="wingR"] { animation: kflapR .4s ease-in-out infinite alternate; }
.kids-svg.mode-balla [data-role="tail"] { animation: kwag .4s ease-in-out infinite alternate; }

.kids-svg.mode-salta [data-role="figure"] { animation: kjump 1.1s ease-in-out infinite; }
.kids-svg.mode-salta [data-role="armL"] { transform: rotate(75deg); }
.kids-svg.mode-salta [data-role="armR"] { transform: rotate(-75deg); }
.kids-svg.mode-salta [data-role="wingL"] { animation: kflapL .25s ease-in-out infinite alternate; }
.kids-svg.mode-salta [data-role="wingR"] { animation: kflapR .25s ease-in-out infinite alternate; }

.kids-svg.mode-nanna [data-role="head"] { transform: rotate(8deg); }
.kids-svg.mode-nanna [data-role="figure"] { animation: kbreathe 5s ease-in-out infinite; }
.kids-svg.mode-nanna [data-role="wheel"], .kids-svg.mode-nanna [data-role="flame"] { animation-play-state: paused; }

.kids-svg [data-role="figure"].waking { animation: kwake .7s ease !important; }
.kids-svg .spark { pointer-events: none; transform-box: fill-box; transform-origin: center; animation: kspark .9s ease-out forwards; }

@keyframes kflash { 0% { stroke-width: 9; } 100% { stroke-width: 4; } }
@keyframes kzzz { 0% { opacity: 0; transform: translate(0, 10px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(14px, -26px); } }
@keyframes kblink { 0%, 90%, 100% { transform: scaleY(1); } 94% { transform: scaleY(0.1); } }
@keyframes kspin { to { transform: rotate(360deg); } }
@keyframes kdrift { from { transform: translateX(-10px); } to { transform: translateX(26px); } }
@keyframes kplant { from { transform: rotate(-7deg); } to { transform: rotate(7deg); } }
@keyframes kbob { from { transform: translateY(-5px); } to { transform: translateY(5px); } }
@keyframes kflame { from { transform: scale(1, 0.85); } to { transform: scale(1.08, 1.15); } }
@keyframes kwag { from { transform: rotate(-12deg); } to { transform: rotate(12deg); } }
@keyframes kwave { 0%, 100% { transform: rotate(-150deg); } 50% { transform: rotate(-112deg); } }
@keyframes ktilt { from { transform: rotate(-6deg); } to { transform: rotate(6deg); } }
@keyframes kflapL { from { transform: rotate(0deg); } to { transform: rotate(-28deg); } }
@keyframes kflapR { from { transform: rotate(0deg); } to { transform: rotate(28deg); } }
@keyframes kears { from { transform: rotate(-8deg); } to { transform: rotate(8deg); } }
@keyframes ksway { from { transform: rotate(-7deg) translateY(0); } to { transform: rotate(7deg) translateY(-6px); } }
@keyframes kdanceL { from { transform: rotate(15deg); } to { transform: rotate(135deg); } }
@keyframes kdanceR { from { transform: rotate(-135deg); } to { transform: rotate(-15deg); } }
@keyframes kjump {
  0% { transform: translateY(0) scale(1.07, 0.92); }
  18% { transform: translateY(0) scale(0.96, 1.05); }
  48% { transform: translateY(-70px) scale(1, 1); }
  78% { transform: translateY(0) scale(1, 1); }
  88% { transform: translateY(0) scale(1.08, 0.91); }
  100% { transform: translateY(0) scale(1.07, 0.92); }
}
@keyframes kbreathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.01, 1.02); } }
@keyframes kwake { 0% { transform: scale(1); } 35% { transform: scale(1.08, 0.92); } 65% { transform: scale(0.96, 1.06) translateY(-14px); } 100% { transform: scale(1); } }
@keyframes kspark { 0% { opacity: 0; transform: scale(0.2); } 30% { opacity: 1; transform: scale(1.2); } 100% { opacity: 0; transform: scale(0.6) translateY(-30px); } }
@media (prefers-reduced-motion: reduce) {
  .kids-svg * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
}
`

// Applica i perni (data-o="x y") come transform-origin, in coordinate del disegno
export function applyPivots(root: Element) {
  root.querySelectorAll<SVGElement>('[data-o]').forEach((el) => {
    const [x, y] = (el.getAttribute('data-o') ?? '').split(/\s+/).map(Number)
    if (Number.isFinite(x) && Number.isFinite(y)) el.style.transformOrigin = `${x}px ${y}px`
  })
}

// «Più di N»: arrotondato per difetto alla decina e sempre minore del vero
// (51 → 50, 50 → 40), così la frase resta vera
export const moreThan = (n: number) => Math.max(10, Math.floor((n - 1) / 10) * 10)

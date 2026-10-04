import { Playfair_Display } from 'next/font/google'

// Carattere "Elegante" dei titoli della Landing Page (anche in cirillico)
export const landingSerif = Playfair_Display({ subsets: ['latin', 'cyrillic'], weight: ['600', '700'], variable: '--lp-serif', display: 'swap' })

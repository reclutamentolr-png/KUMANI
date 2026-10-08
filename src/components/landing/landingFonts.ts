import localFont from 'next/font/local'

// Carattere "Elegante" dei titoli della Landing Page (anche in cirillico)
// Caratteri dentro il progetto (src/fonts, latino e cirillico): la build non
// dipende da Google Fonts
export const landingSerif = localFont({ src: '../../fonts/PlayfairDisplay.woff2', weight: '400 900', variable: '--lp-serif', display: 'swap' })

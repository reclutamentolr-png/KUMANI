import localFont from 'next/font/local'

// Carattere da lettera dei messaggi delle sorprese (Cormorant Garamond, nel
// progetto: niente Google Fonts nella build)
export const letterFont = localFont({
  src: [
    { path: '../../fonts/CormorantGaramond.woff2', style: 'normal', weight: '300 700' },
    { path: '../../fonts/CormorantGaramond-Italic.woff2', style: 'italic', weight: '300 700' },
  ],
  variable: '--font-letter',
  display: 'swap',
})

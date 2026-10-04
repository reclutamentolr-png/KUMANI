import { getImageProps } from 'next/image'

// Apertura "side" della homepage (guida di stile KUMANI): sul computer la
// foto (3:2) occupa il 58% destro, centrata accanto al titolo, e sfuma nel
// nero verso il testo; sul telefono sta sotto il testo con un ritaglio 4:5
// dedicato. Un solo <picture>:
// il browser scarica soltanto l'immagine adatta al dispositivo, subito
// (è il contenuto principale della pagina), in AVIF/WebP grazie a Next.
export default function HeroSideImage({ image, mobileImage, position }: { image: string; mobileImage: string; position?: string }) {
  const common = { alt: '', fetchPriority: 'high' as const, loading: 'eager' as const }
  const {
    props: { srcSet: desktopSet },
  } = getImageProps({ ...common, src: image, width: 2000, height: 1333, quality: 75, sizes: '58vw' })
  const {
    props: { srcSet: mobileSet, ...rest },
  } = getImageProps({ ...common, src: mobileImage, width: 1080, height: 1350, quality: 72, sizes: '100vw' })

  return (
    <div className="relative mx-4 mb-12 aspect-[4/5] overflow-hidden rounded-3xl sm:mx-6 sm:mb-16 lg:absolute lg:right-0 lg:top-1/2 lg:m-0 lg:aspect-[3/2] lg:w-[58%] lg:-translate-y-1/2 lg:rounded-none">
      <picture>
        <source media="(min-width: 1024px)" srcSet={desktopSet} sizes="58vw" />
        <source media="(max-width: 1023px)" srcSet={mobileSet} sizes="100vw" />
        <img {...rest} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position ?? 'center' }} />
      </picture>
      {/* Sul computer la foto sfuma nel nero: verso il testo e in alto/basso */}
      <div aria-hidden className="absolute inset-0 hidden bg-[linear-gradient(90deg,#0c0d0c_0%,rgba(12,13,12,0.8)_18%,rgba(12,13,12,0)_55%)] lg:block" />
      <div aria-hidden className="absolute inset-x-0 top-0 hidden h-24 bg-gradient-to-b from-[#0c0d0c] to-transparent lg:block" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 hidden h-24 bg-gradient-to-t from-[#0c0d0c] to-transparent lg:block" />
    </div>
  )
}

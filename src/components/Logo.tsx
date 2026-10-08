import Image from 'next/image'

// public/senza_sfondo.png è il medaglione "K" di Kumani con sfondo
// trasparente (669x373, non ritagliato a quadrato): con width=height=size e
// object-cover il crop centrale isola il cerchio dorato mantenendo un
// piccolo margine trasparente. Essendo trasparente va bene sia su sfondi
// chiari che scuri, senza bisogno di varianti diverse.
const SRC = '/senza_sfondo.png'

type LogoProps = {
  size?: number
  className?: string
  priority?: boolean
}

export default function Logo({ size = 40, className = '', priority = false }: LogoProps) {
  // Senza misure nel className il CSS di base (height: auto) seguirebbe le
  // proporzioni del file (non quadrato): il logo uscirebbe piccolo e Next
  // avvisa nel terminale. Qui resta sempre un quadrato di `size`.
  const sized = /(^|\s)([a-z]+:)?[hw]-/.test(className)
  return (
    <Image
      src={SRC}
      alt="Kumani"
      width={size}
      height={size}
      priority={priority}
      style={sized ? undefined : { width: size, height: size }}
      className={`shrink-0 object-cover ${className}`}
    />
  )
}

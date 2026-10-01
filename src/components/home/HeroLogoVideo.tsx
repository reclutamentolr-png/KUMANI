// Logo animato dell'apertura (K → stella → K): parte da solo, senza audio,
// in ripetizione. Il fondo nero del video si fonde con la sezione scura
// (mix-blend-screen). Con "riduci movimento" attivo resta il fotogramma fermo.
export default function HeroLogoVideo({ label }: { label: string }) {
  return (
    <div className="relative mx-auto h-40 w-40 sm:h-52 sm:w-52">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/home/logo-video-poster.webp"
        aria-label={label}
        className="home-logo-video h-full w-full rounded-full object-cover mix-blend-screen"
      >
        <source src="/home/logo-video.webm" type="video/webm" />
        <source src="/home/logo-video.mp4" type="video/mp4" />
      </video>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/home/logo-video-poster.webp" alt={label} className="home-logo-still absolute inset-0 hidden h-full w-full rounded-full mix-blend-screen" />
    </div>
  )
}

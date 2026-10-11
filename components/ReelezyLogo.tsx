import Image from 'next/image'

export function ReelezyLogo({ size = 44 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="Reelezy"
      height={size}
      width={size * 4}
      style={{ objectFit: 'contain', objectPosition: 'left center', width: size * 4, height: size }}
      priority
    />
  )
}

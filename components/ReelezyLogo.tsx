import Image from 'next/image'
import Link from 'next/link'

export function ReelezyLogo({ size = 90 }: { size?: number }) {
  return (
    <Link href="/" style={{ display: 'inline-flex', textDecoration: 'none' }}>
      <Image
        src="/logo.png"
        alt="Reelezy"
        height={size}
        width={size * 4}
        style={{ objectFit: 'contain', objectPosition: 'left center', width: size * 4, height: size }}
        priority
      />
    </Link>
  )
}

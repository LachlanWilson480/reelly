import JSZip from 'jszip'
import { supabase } from '@/lib/supabase'

// Short-lived links to show a carousel's pictures
export async function carouselImageUrls(paths: string[], max = paths.length): Promise<string[]> {
  const wanted = paths.slice(0, max)
  if (wanted.length === 0) return []
  const { data, error } = await supabase.storage.from('video-uploads').createSignedUrls(wanted, 3600)
  if (error || !data) return []
  return data.map((d) => d.signedUrl).filter((u): u is string => !!u)
}

// Downloads every picture in a carousel as one zip, numbered in order
export async function downloadCarousel(paths: string[], zipName = 'carousel.zip'): Promise<boolean> {
  const urls = await carouselImageUrls(paths)
  if (urls.length === 0) return false
  const zip = new JSZip()
  await Promise.all(urls.map(async (u, i) => {
    const res = await fetch(u)
    if (!res.ok) return
    const p = paths[i]
    zip.file(`image-${i + 1}${p.slice(p.lastIndexOf('.'))}`, await res.blob())
  }))
  const blob = await zip.generateAsync({ type: 'blob' })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = zipName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
  return true
}

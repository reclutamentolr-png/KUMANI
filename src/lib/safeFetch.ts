import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

// Richieste del server verso indirizzi scritti dagli utenti (SVAT, scanner
// QR): solo siti pubblici. Mai indirizzi interni (localhost, rete privata,
// metadati del cloud…), controllati anche a ogni redirect, così il server non
// può essere usato per "guardare dentro" reti che non sono aperte a tutti.

function isPrivateIPv4(ip: string) {
  const [a, b] = ip.split('.').map(Number)
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

function isPrivateIP(ip: string) {
  if (isIP(ip) === 4) return isPrivateIPv4(ip)
  const v6 = ip.toLowerCase()
  if (v6 === '::' || v6 === '::1') return true
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIPv4(mapped[1])
  return v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb') || v6.startsWith('ff')
}

export class UnsafeUrlError extends Error {}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UnsafeUrlError('invalid_url')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnsafeUrlError('protocol')
  if (url.port && url.port !== '80' && url.port !== '443') throw new UnsafeUrlError('port')
  if (url.username || url.password) throw new UnsafeUrlError('credentials')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new UnsafeUrlError('host')
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => [])
  if (!addresses.length || addresses.some((a) => isPrivateIP(a.address))) throw new UnsafeUrlError('private_address')
  return url
}

/**
 * Come fetch, ma solo verso indirizzi pubblici e seguendo i redirect a mano
 * (al massimo 5), controllando ogni passaggio. Con redirect 'manual' restituisce
 * la prima risposta così com'è.
 */
export async function safeFetch(raw: string, init: RequestInit & { next?: { revalidate?: number } } = {}, maxRedirects = 5): Promise<Response> {
  const follow = (init.redirect ?? 'follow') === 'follow'
  let current = (await assertPublicUrl(raw)).toString()
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(current, { ...init, redirect: 'manual' })
    const location = res.headers.get('location')
    if (!follow || res.status < 300 || res.status >= 400 || !location) {
      if (current !== raw) Object.defineProperty(res, 'url', { value: current })
      return res
    }
    current = (await assertPublicUrl(new URL(location, current).toString())).toString()
  }
  throw new UnsafeUrlError('too_many_redirects')
}

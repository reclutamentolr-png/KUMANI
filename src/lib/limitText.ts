// Testo del limite raggiunto dentro il risultato di un'azione del server
// (vedi lib/appLimits): da mostrare al posto dell'errore generico.
export function limitTextOf(result: unknown): string | null {
  if (result && typeof result === 'object' && 'limitText' in result && typeof (result as { limitText: unknown }).limitText === 'string') {
    return (result as { limitText: string }).limitText
  }
  return null
}

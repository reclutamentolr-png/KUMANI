'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { FileDown, Image as ImageIcon, Pencil, Plus, Printer, Settings, ShieldCheck, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { drawingById } from '@/lib/kids/catalog'
import { addToAlbum, clearChildAlbum, listAlbum, removeFromAlbum, type AlbumItem } from '@/lib/kids/album'
import { drawingPdf, drawingPng, safeFileName, shareOrDownload, standaloneSvg } from '@/lib/kids/export'
import { AVATAR_COLORS, checkPin, clearKidsLock, emptyStore, loadStore, makePin, newId, saveStore, setKidsLock, type KidProfile, type KidsStore } from '@/lib/kids/storage'
import ColoringGame from './ColoringGame'
import PinPad from './PinPad'
import ProfileForm from './ProfileForm'

type Phase = 'loading' | 'welcome' | 'pinCreate' | 'pinConfirm' | 'firstChild' | 'children' | 'childForm' | 'game'
type Gate = { purpose: 'exit' | 'share' | 'manage'; then: () => void } | null
type ShareTarget = { drawingId: string; fills: Record<string, string>; createdAt: number; png?: Blob } | null

// Ora solo nei gestori degli eventi (mai durante il disegno della pagina)
const now = () => Date.now()

// Sblocco del genitore valido per 2 minuti (condividere più disegni di fila)
const PARENT_WINDOW_MS = 2 * 60 * 1000

export default function KidsCorner({ userId }: { userId: string }) {
  const t = useTranslations('kids')
  const locale = useLocale()
  const router = useRouter()
  const [store, setStore] = useState<KidsStore>(emptyStore)
  const [phase, setPhase] = useState<Phase>('loading')
  const [newPin, setNewPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [gate, setGate] = useState<Gate>(null)
  const [fails, setFails] = useState(0)
  const [waitUntil, setWaitUntil] = useState(0)
  const [forgot, setForgot] = useState(false)
  const [editing, setEditing] = useState<KidProfile | null>(null)
  const [share, setShare] = useState<ShareTarget>(null)
  const [album, setAlbum] = useState<AlbumItem[] | null>(null)
  const [albumUrls, setAlbumUrls] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string | null>(null)
  const parentUntil = useRef(0)

  // Avvio: dati dal telefono
  useEffect(() => {
    const s = loadStore(userId)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dati del telefono, letti dopo il primo disegno della pagina
    setStore(s)
    setPhase(!s.pin ? 'welcome' : s.profiles.length === 0 ? 'firstChild' : s.activeId && s.profiles.some((p) => p.id === s.activeId) ? 'game' : 'children')
  }, [userId])

  const commit = useCallback(
    (next: KidsStore) => {
      setStore(next)
      saveStore(userId, next)
    },
    [userId]
  )

  // Blocco attivo appena c'è il codice: KUMANI riporta qui finché il
  // genitore non esce con il codice; il tasto «indietro» resta nel gioco
  const locked = !!store.pin && phase !== 'loading' && phase !== 'welcome' && phase !== 'pinCreate' && phase !== 'pinConfirm'
  useEffect(() => {
    if (!locked) return
    setKidsLock(userId)
    const trap = () => history.pushState({ kids: true }, '', location.href)
    trap()
    window.addEventListener('popstate', trap)
    return () => window.removeEventListener('popstate', trap)
  }, [locked, userId])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const active = store.profiles.find((p) => p.id === store.activeId) ?? null

  const updateProfile = useCallback(
    (profile: KidProfile) => {
      setStore((prev) => {
        const next = { ...prev, profiles: prev.profiles.map((p) => (p.id === profile.id ? profile : p)) }
        saveStore(userId, next)
        return next
      })
    },
    [userId]
  )

  const goFullscreen = () => {
    try {
      if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {})
    } catch {
      // non disponibile (es. iPhone): resta la pagina normale
    }
  }

  // ── Codice del genitore ────────────────────────────────────────────────
  const askParent = (purpose: NonNullable<Gate>['purpose'], then: () => void) => {
    if (purpose === 'share' && now() < parentUntil.current) return then()
    setPinError(null)
    setForgot(false)
    setGate({ purpose, then })
  }

  const submitGate = async (pin: string) => {
    if (!gate) return
    if (now() < waitUntil) {
      setPinError(t('pinWait'))
      return
    }
    if (await checkPin(store, pin)) {
      setFails(0)
      setPinError(null)
      const then = gate.then
      const purpose = gate.purpose
      setGate(null)
      if (purpose === 'exit') return exitCorner()
      if (purpose === 'share') parentUntil.current = now() + PARENT_WINDOW_MS
      then()
      return
    }
    const n = fails + 1
    setFails(n)
    if (n >= 5) {
      setWaitUntil(now() + 30_000)
      setFails(0)
      setPinError(t('pinWait'))
    } else setPinError(t('pinWrong'))
  }

  const exitCorner = () => {
    clearKidsLock()
    try {
      if (document.fullscreenElement) void document.exitFullscreen()
    } catch {
      // niente
    }
    router.replace(`/${locale}/app`)
  }

  // Codice dimenticato: si esce da KUMANI; il genitore rientra con la sua
  // password e ne crea uno nuovo (i bambini e i disegni restano)
  const resetByLogout = async () => {
    commit({ ...store, pin: null })
    clearKidsLock()
    await createClient().auth.signOut().catch(() => {})
    router.replace(`/${locale}/login`)
  }

  // ── Album e condivisione ──────────────────────────────────────────────
  const childLabel = (p: KidProfile) => t('albumCaption', { name: p.name })
  const dateLabel = (ms: number) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(ms)

  const makePng = async (profile: KidProfile, drawingId: string, fills: Record<string, string>, createdAt: number, blank = false) => {
    const d = drawingById(drawingId)
    if (!d) throw new Error('drawing')
    const svg = standaloneSvg(d.svg, fills, blank)
    return blank
      ? drawingPng(svg, t(`drawings.${drawingId}`), t('printCaption'))
      : drawingPng(svg, childLabel(profile), `${t(`drawings.${drawingId}`)} · ${dateLabel(createdAt)} · KUMANI`)
  }

  const saveFinished = async (drawingId: string, fills: Record<string, string>) => {
    if (!active) return
    try {
      const createdAt = now()
      const png = await makePng(active, drawingId, fills, createdAt)
      if (await addToAlbum({ id: newId(), owner: userId, profileId: active.id, drawingId, createdAt, png })) setToast(t('savedToAlbum'))
    } catch {
      // l'album è un di più: il gioco continua
    }
  }

  const openShare = (drawingId: string, fills: Record<string, string>, png?: Blob, createdAt = now()) => {
    askParent('share', async () => {
      const target: ShareTarget = { drawingId, fills, createdAt, png }
      setShare(target)
      if (!png && active) {
        try {
          const made = await makePng(active, drawingId, fills, createdAt)
          setShare((s) => (s && s.drawingId === drawingId ? { ...s, png: made } : s))
        } catch {
          setToast(t('exportError'))
        }
      }
    })
  }

  const doShare = async (kind: 'image' | 'pdf' | 'blank') => {
    if (!share || !active) return
    try {
      const name = safeFileName(`${active.name}-${t(`drawings.${share.drawingId}`)}`)
      if (kind === 'image' && share.png) {
        await shareOrDownload(share.png, `${name}.png`, t('shareText', { name: active.name }))
      } else if (kind === 'pdf' && share.png) {
        await shareOrDownload(await drawingPdf(share.png), `${name}.pdf`, t('shareText', { name: active.name }))
      } else if (kind === 'blank') {
        const png = await makePng(active, share.drawingId, {}, share.createdAt, true)
        await shareOrDownload(await drawingPdf(png), `${safeFileName(t(`drawings.${share.drawingId}`))}-da-colorare.pdf`, t(`drawings.${share.drawingId}`))
      }
    } catch {
      setToast(t('exportError'))
    }
  }

  const openAlbum = async () => {
    if (!active) return
    const items = await listAlbum(userId, active.id)
    const urls: Record<string, string> = {}
    items.forEach((i) => (urls[i.id] = URL.createObjectURL(i.png)))
    Object.values(albumUrls).forEach((u) => URL.revokeObjectURL(u))
    setAlbumUrls(urls)
    setAlbum(items)
  }

  // ── Bambini ───────────────────────────────────────────────────────────
  const saveChild = (value: { name: string; gender: KidProfile['gender']; age: number }) => {
    if (editing) {
      const profiles = store.profiles.map((p) => (p.id === editing.id ? { ...p, ...value } : p))
      commit({ ...store, profiles })
      setEditing(null)
      setPhase('children')
      return
    }
    const profile: KidProfile = {
      id: newId(),
      ...value,
      color: AVATAR_COLORS[store.profiles.length % AVATAR_COLORS.length],
      stars: 0,
      done: [],
      recent: [],
      current: null,
    }
    commit({ ...store, profiles: [...store.profiles, profile], activeId: profile.id })
    setPhase('game')
  }

  const deleteChild = async () => {
    if (!editing) return
    await clearChildAlbum(userId, editing.id)
    const profiles = store.profiles.filter((p) => p.id !== editing.id)
    commit({ ...store, profiles, activeId: store.activeId === editing.id ? null : store.activeId })
    setEditing(null)
    setPhase(profiles.length ? 'children' : 'firstChild')
  }

  // ── Schermate ─────────────────────────────────────────────────────────
  let screen: React.ReactNode = null
  if (phase === 'welcome') {
    screen = (
      <div className="mx-auto grid max-w-lg gap-5 text-[#2B2D52]">
        <h1 className="text-center text-3xl font-extrabold">{t('title')}</h1>
        <p className="text-center text-lg">{t('welcomeText')}</p>
        <ul className="grid gap-3 rounded-2xl border-[3px] border-[#2B2D52] bg-white p-4 text-base">
          <li className="flex gap-3"><ShieldCheck className="h-6 w-6 shrink-0 text-[#2F9E5B]" aria-hidden /> {t('welcomeLock')}</li>
          <li className="flex gap-3"><ShieldCheck className="h-6 w-6 shrink-0 text-[#2F9E5B]" aria-hidden /> {t('welcomePrivacy')}</li>
          <li className="flex gap-3"><ShieldCheck className="h-6 w-6 shrink-0 text-[#2F9E5B]" aria-hidden /> {t('welcomeShare')}</li>
        </ul>
        <p className="rounded-2xl bg-[#FFF3C4] p-3 text-sm">{t('welcomeTip')}</p>
        <button type="button" onClick={() => setPhase('pinCreate')} className="min-h-14 rounded-2xl border-[3px] border-[#2B2D52] bg-[#FF6A3D] text-xl font-extrabold text-white shadow-[3px_3px_0_#2B2D52]">
          {t('createPin')}
        </button>
        <button type="button" onClick={() => router.replace(`/${locale}/app`)} className="text-sm font-bold text-[#61648A] underline">
          {t('notNow')}
        </button>
      </div>
    )
  } else if (phase === 'pinCreate') {
    screen = (
      <PinPad
        title={t('pinCreateTitle')}
        subtitle={t('pinCreateText')}
        error={pinError}
        onComplete={(pin) => {
          setNewPin(pin)
          setPinError(null)
          setPhase('pinConfirm')
        }}
        onCancel={() => setPhase('welcome')}
      />
    )
  } else if (phase === 'pinConfirm') {
    screen = (
      <PinPad
        title={t('pinConfirmTitle')}
        error={pinError}
        onComplete={async (pin) => {
          if (pin !== newPin) {
            setPinError(t('pinMismatch'))
            setPhase('pinCreate')
            return
          }
          const next = { ...store, pin: await makePin(pin) }
          commit(next)
          setPinError(null)
          setPhase(next.profiles.length ? 'children' : 'firstChild')
        }}
        onCancel={() => setPhase('pinCreate')}
      />
    )
  } else if (phase === 'firstChild' || phase === 'childForm') {
    screen = (
      <div className="grid gap-4">
        <h2 className="text-center text-2xl font-extrabold text-[#2B2D52]">{editing ? t('editChild') : phase === 'firstChild' ? t('firstChildTitle') : t('addChild')}</h2>
        <ProfileForm
          initial={editing ?? undefined}
          onSave={saveChild}
          onCancel={store.profiles.length ? () => (setEditing(null), setPhase('children')) : undefined}
          onDelete={editing ? deleteChild : undefined}
        />
      </div>
    )
  } else if (phase === 'children') {
    screen = (
      <div className="mx-auto grid w-full max-w-lg gap-5">
        <h2 className="text-center text-3xl font-extrabold text-[#2B2D52]">{t('whoPlays')}</h2>
        <div className="grid grid-cols-2 gap-4">
          {store.profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                commit({ ...store, activeId: p.id })
                setPhase('game')
                goFullscreen()
              }}
              className="grid justify-items-center gap-2 rounded-3xl border-[3px] border-[#2B2D52] bg-white p-4 shadow-[4px_4px_0_#2B2D52]"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-full text-4xl font-extrabold text-white" style={{ background: p.color }}>
                {p.name.charAt(0).toUpperCase()}
              </span>
              <span className="text-xl font-extrabold text-[#2B2D52]">{p.name}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => askParent('manage', () => (setEditing(null), setPhase('childForm')))} className="flex min-h-12 items-center gap-2 rounded-2xl border-[3px] border-[#2B2D52] bg-white px-4 font-extrabold text-[#2B2D52]">
            <Plus className="h-5 w-5" /> {t('addChild')}
          </button>
          <button type="button" onClick={() => askParent('manage', () => setEditing({ ...store.profiles[0] }))} className="flex min-h-12 items-center gap-2 rounded-2xl border-[3px] border-[#2B2D52] bg-white px-4 font-extrabold text-[#2B2D52]">
            <Settings className="h-5 w-5" /> {t('manageChildren')}
          </button>
        </div>
        {editing && phase === 'children' && (
          <div className="grid gap-2 rounded-2xl border-[3px] border-[#2B2D52] bg-white p-3">
            <p className="font-extrabold text-[#2B2D52]">{t('chooseToEdit')}</p>
            {store.profiles.map((p) => (
              <button key={p.id} type="button" onClick={() => (setEditing(p), setPhase('childForm'))} className="flex items-center justify-between rounded-xl px-3 py-2 text-left font-bold text-[#2B2D52] hover:bg-[#F3F7FB]">
                {p.name} · {t('ageYears', { age: p.age })} <Pencil className="h-4 w-4" />
              </button>
            ))}
            <button type="button" onClick={() => setEditing(null)} className="justify-self-end text-sm font-bold text-[#61648A]">
              {t('close')}
            </button>
          </div>
        )}
      </div>
    )
  } else if (phase === 'game' && active) {
    screen = (
      <ColoringGame
        key={active.id}
        profile={active}
        sound={store.sound}
        voice={store.voice}
        onToggleSound={() => commit({ ...store, sound: !store.sound })}
        onToggleVoice={() => commit({ ...store, voice: !store.voice })}
        onProfileChange={updateProfile}
        actions={{
          askParent: (purpose, then) => askParent(purpose, then),
          openAlbum: () => void openAlbum(),
          openShare: (drawingId, fills) => openShare(drawingId, fills),
          switchChild: () => setPhase('children'),
          saveFinished: (drawingId, fills) => void saveFinished(drawingId, fills),
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[2147483000] flex flex-col overflow-y-auto bg-[#F3F7FB] text-[#2B2D52]" style={{ backgroundImage: 'radial-gradient(#D9E3EE 1.4px, transparent 1.4px)', backgroundSize: '22px 22px', paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', paddingLeft: 'max(12px, env(safe-area-inset-left))', paddingRight: 'max(12px, env(safe-area-inset-right))' }}>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center">{screen}</div>

      {/* Codice del genitore */}
      {gate && (
        <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[#F3F7FB]/95 p-4" role="dialog" aria-modal="true">
          {forgot ? (
            <div className="mx-auto grid max-w-sm gap-4 text-center">
              <h2 className="text-2xl font-extrabold">{t('forgotTitle')}</h2>
              <p>{t('forgotText')}</p>
              <button type="button" onClick={() => void resetByLogout()} className="min-h-12 rounded-2xl border-[3px] border-[#2B2D52] bg-white px-4 font-extrabold">
                {t('forgotAction')}
              </button>
              <button type="button" onClick={() => setForgot(false)} className="text-sm font-bold text-[#61648A]">
                {t('cancel')}
              </button>
            </div>
          ) : (
            <PinPad
              title={t(`gate.${gate.purpose}`)}
              subtitle={t('gateText')}
              error={pinError}
              onComplete={submitGate}
              onCancel={() => setGate(null)}
              footer={
                <button type="button" onClick={() => setForgot(true)} className="text-sm font-bold text-[#61648A] underline">
                  {t('forgotPin')}
                </button>
              }
            />
          )}
        </div>
      )}

      {/* Salva e condividi (dopo il codice del genitore) */}
      {share && active && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={t('saveShare')}>
          <div className="grid w-full max-w-md gap-3 rounded-3xl border-[3px] border-[#2B2D52] bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold">{t('saveShare')}</h2>
              <button type="button" onClick={() => setShare(null)} aria-label={t('close')} className="rounded-xl p-2"><X className="h-6 w-6" /></button>
            </div>
            <p className="text-sm text-[#61648A]">{t('shareHint')}</p>
            <SheetButton disabled={!share.png} onClick={() => void doShare('image')} icon={<ImageIcon className="h-6 w-6" />} title={t('shareImage')} text={t('shareImageText')} />
            <SheetButton disabled={!share.png} onClick={() => void doShare('pdf')} icon={<FileDown className="h-6 w-6" />} title={t('sharePdf')} text={t('sharePdfText')} />
            <SheetButton onClick={() => void doShare('blank')} icon={<Printer className="h-6 w-6" />} title={t('shareBlank')} text={t('shareBlankText')} />
          </div>
        </div>
      )}

      {/* Album */}
      {album && active && (
        <div className="fixed inset-0 z-10 flex flex-col bg-[#F3F7FB] p-4" role="dialog" aria-modal="true" aria-label={t('album')}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-extrabold">{t('albumTitle', { name: active.name })}</h2>
            <button type="button" onClick={() => setAlbum(null)} className="rounded-2xl border-[3px] border-[#2B2D52] bg-white px-4 py-2 font-extrabold">
              {t('close')}
            </button>
          </div>
          {album.length === 0 ? (
            <p className="m-auto max-w-xs text-center text-lg font-bold text-[#61648A]">{t('albumEmpty')}</p>
          ) : (
            <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto pb-6 sm:grid-cols-3">
              {album.map((item) => (
                <figure key={item.id} className="relative overflow-hidden rounded-2xl border-[3px] border-[#2B2D52] bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={albumUrls[item.id]} alt={t(`drawings.${item.drawingId}`)} className="block w-full" />
                  <div className="flex gap-1 p-1">
                    <button type="button" onClick={() => openShare(item.drawingId, {}, item.png, item.createdAt)} className="flex-1 rounded-xl bg-[#FFC93C] py-2 text-sm font-extrabold">
                      {t('saveShare')}
                    </button>
                    <button
                      type="button"
                      aria-label={t('deleteDrawing')}
                      onClick={() =>
                        askParent('manage', async () => {
                          await removeFromAlbum(item.id)
                          setAlbum((a) => a?.filter((x) => x.id !== item.id) ?? null)
                        })
                      }
                      className="rounded-xl px-3 text-red-700"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-30 mx-auto w-fit max-w-[90%] rounded-2xl bg-[#2B2D52] px-5 py-3 text-center font-bold text-white shadow-lg" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

function SheetButton({ icon, title, text, onClick, disabled }: { icon: React.ReactNode; title: string; text: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex items-center gap-3 rounded-2xl border-[3px] border-[#2B2D52] bg-white p-3 text-left disabled:opacity-50">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F3F7FB]">{icon}</span>
      <span>
        <span className="block font-extrabold">{title}</span>
        <span className="block text-sm text-[#61648A]">{text}</span>
      </span>
    </button>
  )
}

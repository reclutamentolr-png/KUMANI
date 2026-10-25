"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Camera,
  Check,
  LoaderCircle,
  RotateCcw,
  SwitchCamera,
  X,
} from "lucide-react";

// Fotocamera nella pagina (computer con webcam): sul computer il campo «file»
// con capture apre sempre la scelta del file, quindi lo scatto si fa qui.
// Sul telefono si usa la fotocamera del sistema, che fa foto migliori.

// Vero sui dispositivi con il mouse (computer): lì serve questa finestra
export const needsCameraDialog = () =>
  typeof window !== "undefined" &&
  !window.matchMedia("(pointer: coarse)").matches &&
  !!navigator.mediaDevices?.getUserMedia;

export default function CameraDialog({
  facing = "user",
  onPhoto,
  onClose,
}: {
  facing?: "user" | "environment";
  onPhoto: (photo: File) => void;
  onClose: () => void;
}) {
  const t = useTranslations("camera");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState(facing);
  const [state, setState] = useState<"starting" | "live" | "denied" | "none">(
    "starting",
  );
  const [cameras, setCameras] = useState(0);
  // Foto appena scattata, da confermare o rifare
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      .then(async (s) => {
        if (!alive) return s.getTracks().forEach((tr) => tr.stop());
        stream = s;
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          await video.play().catch(() => {});
        }
        setState("live");
        const devices = await navigator.mediaDevices
          .enumerateDevices()
          .catch(() => []);
        if (alive)
          setCameras(devices.filter((d) => d.kind === "videoinput").length);
      })
      .catch(
        (e: DOMException) =>
          alive &&
          setState(
            e?.name === "NotAllowedError" || e?.name === "SecurityError"
              ? "denied"
              : "none",
          ),
      );
    return () => {
      alive = false;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [mode]);

  // Esc chiude la fotocamera
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d")!.drawImage(video, 0, 0);
    c.toBlob(
      (b) =>
        b &&
        setShot({
          file: new File([b], "foto.jpg", { type: "image/jpeg" }),
          url: URL.createObjectURL(b),
        }),
      "image/jpeg",
      0.95,
    );
  };

  const retake = () => {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
  };

  useEffect(() => () => void (shot && URL.revokeObjectURL(shot.url)), [shot]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--ink)] text-white"
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 text-sm font-semibold hover:text-[var(--gold-bright)]"
        >
          <X className="h-5 w-5" /> {t("cancel")}
        </button>
        <p className="text-sm font-semibold">{t("title")}</p>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {state === "denied" || state === "none" ? (
          <p className="max-w-md rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-800">
            {t(state === "denied" ? "errDenied" : "errNone")}
          </p>
        ) : (
          <div className="relative">
            {shot && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shot.url}
                alt={t("preview")}
                className="absolute inset-0 z-10 h-full w-full rounded-xl bg-black object-contain"
              />
            )}
            {/* Anteprima a specchio come uno specchio vero; la foto resta dritta */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="block max-h-[calc(100dvh-180px)] max-w-full rounded-xl bg-black"
              style={mode === "user" ? { transform: "scaleX(-1)" } : undefined}
            />
            {state === "starting" && (
              <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
                <LoaderCircle className="h-5 w-5 animate-spin" />{" "}
                {t("starting")}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-3 border-t border-white/10 px-4 py-4">
        {shot ? (
          <>
            <button
              type="button"
              onClick={retake}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/25 px-5 py-3 text-sm font-bold hover:border-[var(--gold-bright)]"
            >
              <RotateCcw className="h-5 w-5" /> {t("retake")}
            </button>
            <button
              type="button"
              onClick={() => onPhoto(shot.file)}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--gold)] px-6 py-3 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold-bright)]"
            >
              <Check className="h-5 w-5" /> {t("use")}
            </button>
          </>
        ) : (
          <>
            {cameras > 1 && (
              <button
                type="button"
                onClick={() => (
                  setState("starting"),
                  setMode((m) => (m === "user" ? "environment" : "user"))
                )}
                aria-label={t("switch")}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 hover:border-[var(--gold-bright)]"
              >
                <SwitchCamera className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              disabled={state !== "live"}
              onClick={shoot}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--gold)] px-6 py-3 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold-bright)] disabled:opacity-50"
            >
              <Camera className="h-5 w-5" /> {t("shoot")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

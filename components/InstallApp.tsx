"use client";

import { useEffect, useState } from "react";

/** Chrome/Edge/Android's install event (not in the TS DOM lib). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Lang = "en" | "fr" | "es" | "pt";
const COPY: Record<Lang, { button: string; title: string; ios: string[]; other: string[]; close: string }> = {
  en: {
    button: "Download app",
    title: "Add First Payday to your home screen",
    ios: ["Tap the Share button ⬆️ at the bottom (or top) of Safari.", "Scroll and tap “Add to Home Screen”.", "Tap “Add”. First Payday now opens like an app."],
    other: ["Open your browser's menu (⋮ or ⋯).", "Choose “Install app” or “Add to Home screen”.", "Confirm. First Payday now opens like an app."],
    close: "Got it",
  },
  fr: {
    button: "Télécharger l'app",
    title: "Ajouter First Payday à l'écran d'accueil",
    ios: ["Touchez le bouton Partager ⬆️ de Safari.", "Faites défiler et touchez « Sur l'écran d'accueil ».", "Touchez « Ajouter ». First Payday s'ouvre maintenant comme une app."],
    other: ["Ouvrez le menu du navigateur (⋮ ou ⋯).", "Choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil ».", "Confirmez. First Payday s'ouvre maintenant comme une app."],
    close: "Compris",
  },
  es: {
    button: "Descargar app",
    title: "Agrega First Payday a tu pantalla de inicio",
    ios: ["Toca el botón Compartir ⬆️ de Safari.", "Desliza y toca “Agregar a inicio”.", "Toca “Agregar”. First Payday ahora se abre como una app."],
    other: ["Abre el menú del navegador (⋮ o ⋯).", "Elige “Instalar app” o “Agregar a la pantalla principal”.", "Confirma. First Payday ahora se abre como una app."],
    close: "Entendido",
  },
  pt: {
    button: "Baixar app",
    title: "Adicione o First Payday à tela de início",
    ios: ["Toque no botão Compartilhar ⬆️ do Safari.", "Role e toque em “Adicionar à Tela de Início”.", "Toque em “Adicionar”. O First Payday agora abre como um app."],
    other: ["Abra o menu do navegador (⋮ ou ⋯).", "Escolha “Instalar app” ou “Adicionar à tela inicial”.", "Confirme. O First Payday agora abre como um app."],
    close: "Entendi",
  },
};

/**
 * "📲 Download app": installs the web app on the home screen (Android/desktop one tap;
 * iPhone/iPad show Apple's Share → Add to Home Screen steps). Hidden once installed.
 */
export function InstallApp({ lang = "en", compact = false }: { lang?: string; compact?: boolean }) {
  const t = COPY[(lang as Lang) in COPY ? (lang as Lang) : "en"];
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState<null | "ios" | "other">(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const click = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    setHelp(ios ? "ios" : "other");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void click()}
        aria-label={t.button}
        className={`inline-flex items-center gap-1.5 rounded-full bg-card font-bold text-ink ring-1 ring-line whitespace-nowrap hover:bg-paper-deep ${compact ? "px-2.5 py-1.5 text-sm sm:px-3" : "px-4 py-2 text-sm"}`}
      >
        <span aria-hidden>📲</span>
        <span className={compact ? "hidden sm:inline" : ""}>{t.button}</span>
      </button>
      {help ? (
        <div role="dialog" aria-modal="true" aria-label={t.title} className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center" onClick={() => setHelp(null)}>
          <div className="w-full max-w-md rounded-3xl bg-paper p-6 text-left shadow-[var(--shadow-pop)]" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-2xl font-bold text-ink">📲 {t.title}</h2>
            <ol className="mt-4 flex list-decimal flex-col gap-3 pl-6 text-lg text-ink">
              {(help === "ios" ? t.ios : t.other).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <button type="button" onClick={() => setHelp(null)} className="mt-6 min-h-12 w-full rounded-full bg-maple font-black text-white">
              {t.close}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

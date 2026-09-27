import type { Locale } from "@/lib/i18n";

// Messages returned by the login / signup / reset server actions, in the visitor's language.
const COPY = {
  en: {
    password8: "Use at least 8 characters.",
    emailPassword: "Enter your email and password.",
    noMatch: "That email and password don't match.",
    emailFirst: "Enter your email first.",
    linkFailed: "We couldn't send a link to that email.",
    linkSent: "Check your email for a login link.",
    acceptTerms: "Please accept the Terms and Privacy Policy.",
    confirmEmail: "Check your email to confirm your account, then come back to log in.",
    validEmail: "Enter a valid email.",
    resetSent: "If that email has an account, a reset link is on its way.",
    resetExpired: "Your reset link expired. Request a new one.",
    checkForm: "Check your email and password.",
    alreadyRegistered: "An account already exists with this email. Log in instead.",
  },
  fr: {
    password8: "Utilisez au moins 8 caractères.",
    emailPassword: "Entrez votre courriel et votre mot de passe.",
    noMatch: "Ce courriel et ce mot de passe ne correspondent pas.",
    emailFirst: "Entrez d'abord votre courriel.",
    linkFailed: "Impossible d'envoyer un lien à ce courriel.",
    linkSent: "Consultez vos courriels : un lien de connexion vous attend.",
    acceptTerms: "Veuillez accepter les conditions d'utilisation et la politique de confidentialité.",
    confirmEmail: "Consultez vos courriels pour confirmer votre compte, puis revenez vous connecter.",
    validEmail: "Entrez une adresse courriel valide.",
    resetSent: "Si un compte existe pour ce courriel, un lien de réinitialisation est en route.",
    resetExpired: "Votre lien de réinitialisation a expiré. Demandez-en un nouveau.",
    checkForm: "Vérifiez votre courriel et votre mot de passe.",
    alreadyRegistered: "Un compte existe déjà avec ce courriel. Connectez-vous plutôt.",
  },
  es: {
    password8: "Usa al menos 8 caracteres.",
    emailPassword: "Escribe tu correo y tu contraseña.",
    noMatch: "Ese correo y esa contraseña no coinciden.",
    emailFirst: "Primero escribe tu correo.",
    linkFailed: "No pudimos enviar un enlace a ese correo.",
    linkSent: "Revisa tu correo: te enviamos un enlace para entrar.",
    acceptTerms: "Acepta los Términos y la Política de privacidad.",
    confirmEmail: "Revisa tu correo para confirmar tu cuenta y luego vuelve a iniciar sesión.",
    validEmail: "Escribe un correo válido.",
    resetSent: "Si ese correo tiene una cuenta, te enviamos un enlace para restablecerla.",
    resetExpired: "Tu enlace expiró. Pide uno nuevo.",
    checkForm: "Revisa tu correo y tu contraseña.",
    alreadyRegistered: "Ya existe una cuenta con este correo. Mejor inicia sesión.",
  },
  pt: {
    password8: "Use pelo menos 8 caracteres.",
    emailPassword: "Digite seu e-mail e sua senha.",
    noMatch: "Esse e-mail e essa senha não conferem.",
    emailFirst: "Digite seu e-mail primeiro.",
    linkFailed: "Não conseguimos enviar um link para esse e-mail.",
    linkSent: "Confira seu e-mail: enviamos um link para entrar.",
    acceptTerms: "Aceite os Termos e a Política de Privacidade.",
    confirmEmail: "Confira seu e-mail para confirmar sua conta e depois volte para entrar.",
    validEmail: "Digite um e-mail válido.",
    resetSent: "Se esse e-mail tiver uma conta, um link para redefinir a senha está a caminho.",
    resetExpired: "Seu link expirou. Peça um novo.",
    checkForm: "Confira seu e-mail e sua senha.",
    alreadyRegistered: "Já existe uma conta com esse e-mail. Entre em vez disso.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type AuthKey = keyof (typeof COPY)["en"];

export function authCopy(locale: Locale) {
  return (key: AuthKey) => COPY[locale][key] ?? COPY.en[key];
}

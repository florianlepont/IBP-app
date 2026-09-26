// Filled by plan 01.9-14; no other plan edits this section.
// Texts of the sign-in screen (screens/AuthGateScreen.tsx and screens/auth-gate/).
export const authGateFr = {
  hero: {
    title: "Indice de\nBiodiversité Potentielle",
    subtitle: "un service proposé par\nEtats Sauvages",
    a11yLabel: "Indice de Biodiversité Potentielle, un service proposé par Etats Sauvages.",
    devConfigA11yLabel: "Ouvrir la configuration dev",
  },
  panel: {
    title: "Bienvenue",
    subtitle: "Connectez-vous ou créez un compte.\nVos relevés restent disponibles hors-ligne.",
    login: "Se connecter",
    loginInProgress: "Connexion en cours…",
    register: "Créer un compte",
    forgotPassword: "Mot de passe oublié ?",
  },
  legal: {
    prefix: "En continuant, vous acceptez nos",
    terms: "Conditions d'utilisation",
    and: "et notre",
    privacy: "Politique de confidentialité",
    suffix: ".",
    website: "etatssauvages.org",
  },
  devConfig: {
    title: "Configuration dev",
    apiUrlLabel: "URL de l'API",
    apiUrlPlaceholder: "http://192.168.x.x:3000/v1",
    hint: "Simulateur iOS : localhost · Appareil physique : IP locale du Mac sur le même Wi-Fi",
  },
} as const

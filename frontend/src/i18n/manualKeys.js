// Keys that must always be hand-translated and hand-reviewed — never overwritten
// by scripts/translate-i18n.mjs. These carry religious certification claims
// (Halal/Vegan), diplomatic/event-identity claims (COP17), or legal/payment
// wording, where a machine-translation mistake is a trust or compliance
// problem, not just an awkward sentence.
//
// When adding a new EN key with this kind of content, list it here BEFORE
// running the translate script — the script fills in any key missing from
// ar/hi, so an unlisted sensitive key would get auto-translated on its first run.
export const MANUAL_KEYS = [
  'heroTitle3',        // "COP17 Delegates" — event/identity claim
  'heroDesc',          // "Certified Halal & Vegan..." — certification claim
  'aboutDesc',         // mentions "Halal certified dishes"
  'refundWarning',     // refund policy — legal wording
  'orderConfirmedChatNote', // refund/support-request instructions on the payment-success page
  'agreeTermsPrefix',  // terms-of-service agreement label
  'agreeTermsLink',    // "Terms of Service & Refund Policy"
  'termsModalTitle',   // "Terms of Service & Policies"
  'orderConfirmedDesc',// "Payment is collected on delivery" — payment policy
  'paymentSuccessTitle', // payment result wording — trust-sensitive
  'paymentSuccessDesc',
  'paymentPendingTitle',
  'paymentPendingDesc',
  'paymentFailedTitle',
  'paymentFailedDesc',
  'dietTypeSelectTitle', // dietary-identity selection (Halal/Vegan/...) copy
  'dietTypeSelectDesc',
  'dietTypeSelectBtn',
  'allergySectionTitle', // allergen names — a wrong word here is a safety issue
  'allergySectionHint',
  'allergyOptionGluten',
  'allergyOptionDairy',
  'allergyOptionNuts',
  'allergyOptionEggs',
  'allergyOptionFish',
  'allergyOptionSesame',
  'allergyOtherPlaceholder',
];

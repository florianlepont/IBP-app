// D-11: derived from both parcel ID producers so the pattern never rejects a
// server-generated ID: synthetic IDs are 5-digit commune code + 1-3 letter
// section + 1-4 digit number (cadastre-provider.service.ts resolveSynthetic),
// IGN idu values are 14 chars incl. Corsican 2A/2B prefixes, and the IGN
// reverse geocoder keeps any [0-9A-Z] character.
export const PARCEL_ID_PATTERN = /^[0-9A-Z]{1,32}$/i
export const MAX_PARCEL_IDS = 50

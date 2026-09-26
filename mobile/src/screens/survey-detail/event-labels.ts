import { fr } from "../../i18n"

export type KnownEventType = keyof typeof fr.surveyDetail.eventTypes

export const KNOWN_EVENT_TYPES = Object.keys(fr.surveyDetail.eventTypes) as KnownEventType[]

const isKnownEventType = (type: string): type is KnownEventType =>
  Object.prototype.hasOwnProperty.call(fr.surveyDetail.eventTypes, type)

// French label of a survey event type. An unknown type (a newer server) gets
// the generic label, never the raw type string (D-06).
export const eventTypeLabel = (type: string): string =>
  isKnownEventType(type) ? fr.surveyDetail.eventTypes[type] : fr.surveyDetail.unknownEventType

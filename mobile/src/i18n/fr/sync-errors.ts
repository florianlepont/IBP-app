// Per-survey sync error shown to users (app/formatters.ts formatSyncErrorForUser).
export const syncErrorsFr = {
  // Keyed by local_surveys.last_sync_error_code. Client codes come from
  // storage/utils.ts (deriveSurveyErrorCode, deriveAttachmentErrorCode) and
  // storage/sync.ts; server codes come from the sync result error.code.
  byCode: {
    sync_version_conflict: "Le relevé a changé sur le serveur — ouvrez-le pour vérifier",
    survey_validation_failed: "Données invalides — ouvrez le relevé pour corriger",
    bad_request: "Données invalides — ouvrez le relevé pour corriger",
    unauthorized: "Session expirée — reconnectez-vous",
    forbidden: "Accès refusé à ce relevé",
    not_found: "Relevé introuvable sur le serveur",
    rate_limited: "Trop de demandes — réessayez dans quelques minutes",
    transient_upstream_error: "Serveur indisponible — réessayez plus tard",
    network_gateway_error: "Erreur réseau — réessayez plus tard",
    retry_cap_reached: "Synchronisation bloquée après plusieurs échecs",
    sync_failed: "Erreur de synchronisation — ouvrez le relevé pour corriger",
    local_file_missing: "Photo introuvable sur cet appareil — supprimez-la ou reprenez-la",
    attachment_bad_request: "Photo refusée par le serveur",
    attachment_validation_failed: "Photo refusée par le serveur",
    attachment_sync_failed: "Envoi de la photo impossible — réessayez plus tard",
    attachment_not_uploaded: "Envoi de la photo incomplet — réessayez plus tard",
    attachment_size_mismatch: "Photo incomplète — reprenez la photo",
    invalid_attachment_response: "Réponse inattendue du serveur pour une photo",
    invalid_local_payload: "Relevé illisible sur cet appareil",
    submit_validation: "Le relevé n'est pas prêt à être soumis — ouvrez-le pour corriger",
    submit_failed: "Soumission impossible — ouvrez le relevé pour réessayer",
    invalid_operation: "Opération refusée par le serveur",
    invalid_sync_operation: "Opération refusée par le serveur",
    sync_fatal_error: "Erreur de synchronisation — ouvrez le relevé pour corriger",
    parcel_required: "Aucune parcelle choisie — ouvrez le relevé pour en choisir une",
    parcel_invalid: "Parcelle invalide — ouvrez le relevé pour en choisir une autre",
    parcel_version_conflict: "La parcelle a changé sur le serveur — ouvrez le relevé pour vérifier",
    survey_id_conflict: "Ce relevé existe déjà sur le serveur",
    survey_submitted_read_only: "Relevé déjà soumis — il ne peut plus être modifié",
    submitted_read_only_fields: "Relevé déjà soumis — certains champs ne peuvent plus changer",
  },
  // Fallback for rows written before error codes existed: matched on the stored
  // error text by app/formatters.ts, never shown verbatim.
  patterns: {
    siteNameMissing: "Le nom du site est manquant",
    regionMissing: "La région est manquante",
    vegetationMissing: "Le stade de végétation est manquant",
    invalidData: "Données invalides — ouvrez le relevé pour corriger",
    network: "Erreur réseau — réessayez plus tard",
    session: "Session expirée — reconnectez-vous",
  },
  generic: "Erreur de synchronisation — ouvrez le relevé pour corriger",
} as const

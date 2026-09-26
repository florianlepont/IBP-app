// D-07: the only place in api/src that spells the survey_events insert. seq and xid are
// column defaults (migration 014) and are never named here.
// A leaf module with no imports: SurveyEventsService (which injects SurveysRepository) and the
// repository's D-09 fast-path statements both use it without an import cycle.
export const SURVEY_EVENT_INSERT_SQL =
  "INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)"

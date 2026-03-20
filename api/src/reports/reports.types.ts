export type ReportStatus = "open" | "reviewed"

export type ReportRow = {
  id: string
  survey_id: string
  reporter_user_id: string
  reason: string
  status: ReportStatus
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

export type CreateReportBody = {
  survey_id?: string
  reason?: string
}

export type PatchReportBody = {
  status?: ReportStatus
}

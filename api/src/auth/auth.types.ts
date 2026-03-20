export type AuthenticatedUser = {
  id: string
  email: string
  role: "contributor" | "moderator" | "admin"
  first_name: string
  last_name: string
  display_name: string
  profile_picture_url: string | null
}

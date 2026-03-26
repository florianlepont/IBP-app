import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common"

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN ?? ""
const AUTH0_MGMT_CLIENT_ID = process.env.AUTH0_MGMT_CLIENT_ID ?? ""
const AUTH0_MGMT_CLIENT_SECRET = process.env.AUTH0_MGMT_CLIENT_SECRET ?? ""

@Injectable()
export class Auth0ManagementService {
  private cachedToken: string | null = null
  private tokenExpiresAt = 0

  private async getManagementToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken
    }

    const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: AUTH0_MGMT_CLIENT_ID,
        client_secret: AUTH0_MGMT_CLIENT_SECRET,
        audience: `https://${AUTH0_DOMAIN}/api/v2/`,
      }),
    })

    if (!response.ok) {
      throw new InternalServerErrorException("Failed to get Auth0 management token")
    }

    const data = (await response.json()) as { access_token: string; expires_in: number }
    this.cachedToken = data.access_token
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000
    return this.cachedToken
  }

  async updateEmail(auth0Sub: string, newEmail: string): Promise<void> {
    const token = await this.getManagementToken()

    const encodedSub = encodeURIComponent(auth0Sub)
    const response = await fetch(`https://${AUTH0_DOMAIN}/api/v2/users/${encodedSub}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: newEmail,
        email_verified: false,
        verify_email: true,
      }),
    })

    if (response.status === 409) {
      throw new BadRequestException("Email already in use")
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string }
      throw new InternalServerErrorException(body.message ?? "Failed to update email on Auth0")
    }
  }
}

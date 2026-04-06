import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common"

@Injectable()
export class Auth0ManagementService {
  private cachedToken: string | null = null
  private tokenExpiresAt = 0

  private getManagementConfig(): {
    domain: string
    managementClientId: string
    managementClientSecret: string
  } {
    return {
      domain: process.env.AUTH0_DOMAIN ?? "",
      managementClientId: process.env.AUTH0_MGMT_CLIENT_ID ?? "",
      managementClientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET ?? "",
    }
  }

  private isManagementConfigured(): boolean {
    const { domain, managementClientId, managementClientSecret } = this.getManagementConfig()
    return Boolean(domain && managementClientId && managementClientSecret)
  }

  private async getManagementToken(): Promise<string> {
    const { domain, managementClientId, managementClientSecret } = this.getManagementConfig()

    if (!this.isManagementConfigured()) {
      throw new InternalServerErrorException("Auth0 management API is not configured")
    }

    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken
    }

    const response = await fetch(`https://${domain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: managementClientId,
        client_secret: managementClientSecret,
        audience: `https://${domain}/api/v2/`,
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
    const { domain } = this.getManagementConfig()
    const token = await this.getManagementToken()

    const encodedSub = encodeURIComponent(auth0Sub)
    const response = await fetch(`https://${domain}/api/v2/users/${encodedSub}`, {
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

  async deleteUser(auth0Sub: string): Promise<void> {
    if (process.env.NODE_ENV === "test") {
      return
    }

    const { domain } = this.getManagementConfig()
    const token = await this.getManagementToken()
    const encodedSub = encodeURIComponent(auth0Sub)
    const response = await fetch(`https://${domain}/api/v2/users/${encodedSub}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (response.status === 404) {
      return
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string }
      throw new InternalServerErrorException(body.message ?? "Failed to delete Auth0 user")
    }
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    const domain = process.env.AUTH0_DOMAIN ?? ""
    const appClientId = process.env.AUTH0_APP_CLIENT_ID ?? ""

    const response = await fetch(`https://${domain}/dbconnections/change_password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: appClientId,
        email,
        connection: "Username-Password-Authentication",
      }),
    })

    if (!response.ok) {
      throw new InternalServerErrorException("Failed to send password reset email")
    }
  }
}

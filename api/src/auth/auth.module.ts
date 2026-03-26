import { Module } from "@nestjs/common"
import { AuthGuard } from "./auth.guard"
import { Auth0ManagementService } from "./auth0-management.service"

@Module({
  providers: [AuthGuard, Auth0ManagementService],
  exports: [AuthGuard, Auth0ManagementService],
})
export class AuthModule {}

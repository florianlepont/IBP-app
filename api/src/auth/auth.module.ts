import { Module } from "@nestjs/common"
import { EmailModule } from "../email/email.module"
import { AuthController } from "./auth.controller"
import { AuthService } from "./auth.service"
import { AuthGuard } from "./auth.guard"

@Module({
  imports: [EmailModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}

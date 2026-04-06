import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { DatabaseModule } from "../database/database.module"
import { DebugController } from "./debug.controller"
import { DebugService } from "./debug.service"

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [DebugController],
  providers: [DebugService],
})
export class DebugModule {}

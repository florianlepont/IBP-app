import { Module } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"
import { ThrottlerModule } from "@nestjs/throttler"
import { AppController } from "./app.controller"
import { AuthModule } from "./auth/auth.module"
import { ClientAwareThrottlerGuard } from "./auth/throttler.guard"
import { buildThrottlerOptions } from "./common/rate-limit.config"
import { DatabaseModule } from "./database/database.module"
import { isDebugSurfaceEnabled } from "./debug/debug-gating"
import { DebugModule } from "./debug/debug.module"
import { ReportsModule } from "./reports/reports.module"
import { SurveysModule } from "./surveys/surveys.module"
import { UsersModule } from "./users/users.module"

@Module({
  imports: [
    ThrottlerModule.forRoot(buildThrottlerOptions()),
    DatabaseModule,
    AuthModule,
    UsersModule,
    SurveysModule,
    ReportsModule,
    ...(isDebugSurfaceEnabled() ? [DebugModule] : []),
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ClientAwareThrottlerGuard }],
})
export class AppModule {}

import { Module } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler"
import { AppController } from "./app.controller"
import { AuthModule } from "./auth/auth.module"
import { DatabaseModule } from "./database/database.module"
import { DebugModule } from "./debug/debug.module"
import { ReportsModule } from "./reports/reports.module"
import { SurveysModule } from "./surveys/surveys.module"
import { UsersModule } from "./users/users.module"

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    DatabaseModule,
    AuthModule,
    UsersModule,
    SurveysModule,
    ReportsModule,
    DebugModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

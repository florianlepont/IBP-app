import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { APP_GUARD } from "@nestjs/core"
import { ThrottlerModule } from "@nestjs/throttler"
import { AppController } from "./app.controller"
import { AuthModule } from "./auth/auth.module"
import { ClientAwareThrottlerGuard } from "./auth/throttler.guard"
import { buildThrottlerOptions } from "./common/rate-limit.config"
import { appConfig } from "./config/app-config"
import { validateEnv } from "./config/env.schema"
import { DatabaseModule } from "./database/database.module"
import { isDebugSurfaceEnabled } from "./debug/debug-gating"
import { DebugModule } from "./debug/debug.module"
import { ReportsModule } from "./reports/reports.module"
import { SurveysModule } from "./surveys/surveys.module"
import { UsersModule } from "./users/users.module"

// D-01: validated, typed configuration. ignoreEnvFile because main.ts already
// loads dotenv and the E2E loader controls precedence. forRoot validates at
// import time and returns a promise: a validation failure (including the
// production rules) rejects it, and Nest surfaces that rejection when it
// resolves the imports, so NestFactory.create rejects.
const configModule = ConfigModule.forRoot({
  isGlobal: true,
  ignoreEnvFile: true,
  cache: true,
  validate: validateEnv,
  load: [appConfig],
})
// Importing AppModule only for its metadata (unit specs) never awaits the
// promise; mark it handled so a refused configuration cannot crash the process
// as an unhandled rejection. Nest still awaits the original promise and fails.
configModule.catch(() => undefined)

// The throttler options and the debug gate are evaluated at decorator time,
// before ConfigService exists: both read NODE_ENV through currentNodeEnv()
// (src/config), never process.env directly (D-01).
@Module({
  imports: [
    configModule,
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

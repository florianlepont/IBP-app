import "reflect-metadata"
import "dotenv/config"
import { Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { NestExpressApplication } from "@nestjs/platform-express"
import { AppModule } from "./app.module"
import { configureApp } from "./app.setup"
import { appConfigOf } from "./config/app-config"

const logger = new Logger("Bootstrap")

async function bootstrap(): Promise<void> {
  // abortOnError: false lets a startup failure (such as a refused production
  // configuration) reject here, so the catch below logs its message only.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { abortOnError: false })

  configureApp(app)

  const { port } = appConfigOf(app.get(ConfigService)).http
  await app.listen(port, "0.0.0.0")

  // Keep startup log explicit for first local setup checks.
  logger.log(`IBP API listening on http://localhost:${port}/v1/health`)
}

bootstrap().catch((error: unknown) => {
  // D-06: message only. A configuration error names variables, never values.
  logger.error(`Failed to start API: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})

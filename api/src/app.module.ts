import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { DebugModule } from './debug/debug.module';
import { ReportsModule } from './reports/reports.module';
import { SurveysModule } from './surveys/surveys.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [DatabaseModule, AuthModule, UsersModule, SurveysModule, ReportsModule, DebugModule],
  controllers: [AppController],
  providers: []
})
export class AppModule {}

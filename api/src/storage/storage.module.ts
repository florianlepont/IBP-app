import { Module } from "@nestjs/common"
import { StorageService } from "./storage.service"

// Not global: consumers import StorageModule explicitly.
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}

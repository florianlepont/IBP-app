import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { Throttle } from "@nestjs/throttler"
import { memoryStorage } from "multer"
import { Response } from "express"
import { AuthGuard } from "../auth/auth.guard"
import { CurrentUser } from "../auth/current-user.decorator"
import { AuthenticatedUser } from "../auth/auth.types"
import { UPLOAD_THROTTLE } from "../common/rate-limit.config"
import { UsersService } from "./users.service"
import { PatchMeDto } from "./dtos/patch-me.dto"
import { ChangeEmailDto } from "./dtos/change-email.dto"

@Controller()
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.id)
  }

  @Patch("me")
  patchMe(@CurrentUser() user: AuthenticatedUser, @Body() body: PatchMeDto) {
    return this.usersService.patchMe(user, body)
  }

  @Patch("me/email")
  @HttpCode(204)
  changeEmail(@CurrentUser() user: AuthenticatedUser, @Body() body: ChangeEmailDto) {
    return this.usersService.changeEmail(user, body.email)
  }

  @Post("me/password-reset")
  @HttpCode(204)
  passwordReset(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.sendPasswordReset(user)
  }

  @Put("me/profile-picture")
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadProfilePicture(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile()
    file?: { buffer: Buffer; mimetype?: string; size?: number; originalname?: string },
  ) {
    return this.usersService.uploadProfilePicture(user, file)
  }

  @Get("me/profile-picture")
  async getProfilePicture(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const picture = await this.usersService.getProfilePicture(user)
    response.setHeader("Content-Type", picture.mimeType)
    response.setHeader("Cache-Control", "private, max-age=60")
    return new StreamableFile(picture.buffer)
  }

  @Delete("me/profile-picture")
  @HttpCode(204)
  async deleteProfilePicture(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.usersService.removeProfilePicture(user)
  }

  @Delete("me")
  @HttpCode(204)
  async deleteAccount(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.usersService.deleteAccount(user)
  }
}

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
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { Response } from 'express'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { AuthenticatedUser } from '../auth/auth.types'
import { UsersService } from './users.service'
import { PatchMeDto } from './dtos/patch-me.dto'
import { ConfirmEmailChangeDto } from './dtos/confirm-email-change.dto'

@Controller()
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.id)
  }

  @Patch('me')
  patchMe(@CurrentUser() user: AuthenticatedUser, @Body() body: PatchMeDto) {
    return this.usersService.patchMe(user, body)
  }

  @Post('me/email/confirm')
  @HttpCode(200)
  confirmEmailChange(@CurrentUser() user: AuthenticatedUser, @Body() body: ConfirmEmailChangeDto) {
    return this.usersService.confirmEmailChange(user, body.token ?? '')
  }

  @Put('me/profile-picture')
  @UseInterceptors(
    FileInterceptor('file', {
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

  @Get('me/profile-picture')
  async getProfilePicture(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const picture = await this.usersService.getProfilePicture(user)
    response.setHeader('Content-Type', picture.mimeType)
    response.setHeader('Cache-Control', 'private, max-age=60')
    return new StreamableFile(picture.buffer)
  }

  @Delete('me/profile-picture')
  @HttpCode(204)
  async deleteProfilePicture(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.usersService.removeProfilePicture(user)
  }
}

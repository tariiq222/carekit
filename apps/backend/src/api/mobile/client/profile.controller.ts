import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ClientGender, ClientSource } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { GetClientHandler } from '../../../modules/people/clients/get-client.handler';
import { UpdateClientHandler } from '../../../modules/people/clients/update-client.handler';

export class MobileUpdateProfileBody {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() email?: string | null;
  @IsOptional() @IsEnum(ClientGender) gender?: ClientGender;
  @IsOptional() @IsString() dateOfBirth?: string | null;
  @IsOptional() @IsString() avatarUrl?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsEnum(ClientSource) source?: ClientSource;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@UseGuards(JwtGuard)
@Controller('mobile/client/profile')
export class MobileClientProfileController {
  constructor(
    private readonly getClient: GetClientHandler,
    private readonly updateClient: UpdateClientHandler,
  ) {}

  @Get()
  getProfile(@CurrentUser() user: JwtUser) {
    return this.getClient.execute({ clientId: user.sub });
  }

  @Patch()
  updateProfile(
    @CurrentUser() user: JwtUser,
    @Body() body: MobileUpdateProfileBody,
  ) {
    return this.updateClient.execute({ clientId: user.sub, ...body });
  }
}

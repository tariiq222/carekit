import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { OtpType } from './enums/otp-type.enum.js';
import { EmailThrottleGuard } from '../../common/guards/email-throttle.guard.js';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return {
      success: true,
      message: 'Registration successful',
      data: result,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @UseGuards(new EmailThrottleGuard(5, 60000))
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid email or password',
        error: 'AUTH_INVALID_CREDENTIALS',
      });
    }
    const result = await this.authService.login(user);
    return {
      success: true,
      data: result,
    };
  }

  @Public()
  @Post('login/otp/send')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @UseGuards(new EmailThrottleGuard(3, 60000))
  async sendLoginOtp(@Body() dto: SendOtpDto) {
    // Always return success for security (don't reveal if email exists)
    const user = await this.authService.findUserByEmail(dto.email);
    if (user) {
      await this.authService.generateOtp(user.id, OtpType.LOGIN);
      // In production, would send email here
    }
    return {
      success: true,
      message: 'OTP sent to your email',
    };
  }

  @Public()
  @Post('login/otp/verify')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @UseGuards(new EmailThrottleGuard(5, 60000))
  async verifyLoginOtp(@Body() dto: VerifyOtpDto) {
    const userPayload = await this.authService.verifyOtp(
      dto.email,
      dto.code,
      OtpType.LOGIN,
    );
    const result = await this.authService.login(userPayload);
    return {
      success: true,
      data: result,
    };
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() dto: RefreshTokenDto) {
    const tokens = await this.authService.refreshToken(dto.refreshToken);
    return {
      success: true,
      data: tokens,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser('id') userId: string) {
    const profile = await this.authService.getUserProfile(userId);
    return profile;
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @UseGuards(new EmailThrottleGuard(3, 60000))
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    // Always return success for security
    const user = await this.authService.findUserByEmail(dto.email);
    if (user) {
      await this.authService.generateOtp(user.id, OtpType.RESET_PASSWORD);
      // In production, would send email here
    }
    return {
      success: true,
      message: 'Password reset OTP sent',
    };
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @UseGuards(new EmailThrottleGuard(3, 60000))
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
    return {
      success: true,
      message: 'Password reset successful',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('password/change')
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('email/verify/send')
  @HttpCode(HttpStatus.OK)
  async sendEmailVerification(@CurrentUser('id') userId: string) {
    await this.authService.generateOtp(userId, OtpType.VERIFY_EMAIL);
    return {
      success: true,
      message: 'Verification OTP sent',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyEmailDto,
  ) {
    await this.authService.verifyEmail(userId, dto.code);
    return {
      success: true,
      message: 'Email verified successfully',
    };
  }

}

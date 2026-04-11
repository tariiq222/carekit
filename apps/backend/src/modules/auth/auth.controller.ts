import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
import { type Request, type Response } from 'express';
import { AuthService } from './auth.service.js';
import { CookieService } from './cookie.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/reset-password.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OtpType } from './enums/otp-type.enum.js';
import { EmailThrottleGuard } from '../../common/guards/email-throttle.guard.js';
import { OtpThrottle } from '../../common/decorators/otp-throttle.decorator.js';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: CookieService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    this.cookieService.setRefreshTokenCookie(res, result.refreshToken);
    const { refreshToken: _rt, ...responseData } = result;
    return responseData;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @OtpThrottle('login', 5)
  @UseGuards(EmailThrottleGuard)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful, returns access token' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid email or password',
        error: 'AUTH_INVALID_CREDENTIALS',
      });
    }
    const result = await this.authService.login(user);
    this.cookieService.setRefreshTokenCookie(res, result.refreshToken);
    const { refreshToken: _rt, ...responseData } = result;
    return responseData;
  }

  @Public()
  @Post('login/otp/send')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @OtpThrottle('otp_send', 3)
  @UseGuards(EmailThrottleGuard)
  @ApiOperation({ summary: 'Send OTP code to email for login' })
  @ApiResponse({ status: 200, description: 'OTP sent (always succeeds for security)' })
  async sendLoginOtp(@Body() dto: SendOtpDto) {
    // Always return success for security (don't reveal if email exists)
    const user = await this.authService.findUserByEmail(dto.email);
    if (user) {
      const code = await this.authService.generateOtp(user.id, OtpType.LOGIN);
      await this.authService.sendOtpEmail(dto.email, code, 'login');
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
  @OtpThrottle('otp_verify', 5)
  @UseGuards(EmailThrottleGuard)
  @ApiOperation({ summary: 'Verify OTP and login' })
  @ApiResponse({ status: 200, description: 'OTP verified, returns access token' })
  async verifyLoginOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userPayload = await this.authService.verifyOtp(
      dto.email,
      dto.code,
      OtpType.LOGIN,
    );
    const result = await this.authService.login(userPayload);
    this.cookieService.setRefreshTokenCookie(res, result.refreshToken);
    const { refreshToken: _rt, ...responseData } = result;
    return responseData;
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Returns new access token' })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken = this.cookieService.extractRefreshToken(req);
    const bodyToken = dto.refreshToken;
    const token = cookieToken || bodyToken;

    if (!token) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Refresh token is required',
        error: 'AUTH_REFRESH_TOKEN_MISSING',
      });
    }

    const tokens = await this.authService.refreshToken(token);
    this.cookieService.setRefreshTokenCookie(res, tokens.refreshToken);

    // Mobile compatibility: if token came from body, include refreshToken in response
    const responseData =
      bodyToken && !cookieToken
        ? tokens
        : { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };

    return responseData;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiStandardResponses()
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token =
      this.cookieService.extractRefreshToken(req) || dto.refreshToken;
    if (token) {
      await this.authService.logout(token);
    }
    this.cookieService.clearRefreshTokenCookie(res);
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Returns user profile' })
  @ApiStandardResponses()
  async getProfile(@CurrentUser('id') userId: string) {
    const profile = await this.authService.getUserProfile(userId);
    return profile;
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @OtpThrottle('pw_forgot', 3)
  @UseGuards(EmailThrottleGuard)
  @ApiOperation({ summary: 'Request password reset OTP' })
  @ApiResponse({ status: 200, description: 'OTP sent (always succeeds for security)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    // Always return success for security
    const user = await this.authService.findUserByEmail(dto.email);
    if (user) {
      const code = await this.authService.generateOtp(
        user.id,
        OtpType.RESET_PASSWORD,
      );
      await this.authService.sendOtpEmail(dto.email, code, 'reset_password');
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
  @OtpThrottle('pw_reset', 3)
  @UseGuards(EmailThrottleGuard)
  @ApiOperation({ summary: 'Reset password using OTP code' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
    return {
      success: true,
      message: 'Password reset successful',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('password/change')
  @ApiOperation({ summary: 'Change password for authenticated user' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiStandardResponses()
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
  @ApiOperation({ summary: 'Send email verification OTP' })
  @ApiResponse({ status: 200, description: 'Verification OTP sent' })
  @ApiStandardResponses()
  async sendEmailVerification(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') email: string,
  ) {
    const code = await this.authService.generateOtp(
      userId,
      OtpType.VERIFY_EMAIL,
    );
    await this.authService.sendOtpEmail(email, code, 'verify_email');
    return {
      success: true,
      message: 'Verification OTP sent',
    };
  }

  @SkipThrottle()
  @OtpThrottle('email_verify', 5)
  @UseGuards(JwtAuthGuard, EmailThrottleGuard)
  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email using OTP code' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiStandardResponses()
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

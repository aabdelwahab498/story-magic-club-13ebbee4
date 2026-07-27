import {
  Controller,
  Post,
  Body,
  Res,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service.js';
import { LoginDto, RegisterDto } from './dto/index.js';
import { Public } from './public.decorator.js';
import { CurrentUser } from '../modules/rbac/decorators/current-user.decorator.js';
import type { UserContext } from '../modules/rbac/interfaces/user-context.interface.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  private setCookie(res: Response, token: string) {
    const cookieName = this.configService.get<string>(
      'JWT_COOKIE_NAME',
      'najmah_token',
    );
    const secure = this.configService.get<boolean>('JWT_COOKIE_SECURE', true);
    const sameSite = this.configService.get<'lax' | 'strict' | 'none'>(
      'JWT_COOKIE_SAMESITE',
      'lax',
    );
    const maxAge = this.configService.get<number>('JWT_COOKIE_MAX_AGE', 604800);

    res.cookie(cookieName, token, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: maxAge * 1000,
      path: '/',
    });
  }

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { data, error } = await this.supabaseService
      .getClient()
      .auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });

    if (error || !data.session) {
      throw new UnauthorizedException(error?.message || 'Invalid credentials');
    }

    this.setCookie(res, data.session.access_token);
    return { success: true, message: 'Logged in successfully' };
  }

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { data, error } = await this.supabaseService.getClient().auth.signUp({
      email: dto.email,
      password: dto.password,
      options: {
        data: {
          display_name: dto.displayName,
        },
      },
    });

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    if (data.session) {
      this.setCookie(res, data.session.access_token);
    }

    return { success: true, message: 'Registration successful' };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    const cookieName = this.configService.get<string>(
      'JWT_COOKIE_NAME',
      'najmah_token',
    );
    res.clearCookie(cookieName, { path: '/' });

    // Background sign out
    await this.supabaseService
      .getClient()
      .auth.signOut()
      .catch(() => {});

    return { success: true, message: 'Logged out successfully' };
  }

  @Get('me')
  getMe(@CurrentUser() user: UserContext) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      roles: user.roles,
      permissions: user.permissions,
      isAuthenticated: true,
    };
  }
}

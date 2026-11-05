import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthResponse, PublicUser } from "@marketplace/shared";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";
import { RequestOtpDto } from "./dto/request-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { AuthenticatedUser } from "./types/jwt-payload.type";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post("otp/request")
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() dto: RequestOtpDto): Promise<{ expiresInSeconds: number }> {
    return this.authService.requestOtp(dto.phone);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("otp/verify")
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<AuthResponse> {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Get("me")
  async me(@CurrentUser() currentUser: AuthenticatedUser): Promise<PublicUser> {
    const user = await this.usersService.findById(currentUser.id);
    if (!user) {
      throw new NotFoundException("Utilisateur introuvable");
    }
    return this.usersService.toPublicUser(user);
  }
}

import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { UsersModule } from "../users/users.module";
import { SmsModule } from "./sms/sms.module";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@Module({
  imports: [JwtModule.register({}), UsersModule, SmsModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}

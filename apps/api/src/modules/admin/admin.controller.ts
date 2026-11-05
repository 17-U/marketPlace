import { Controller, Get } from "@nestjs/common";
import { AdminStatsDto, Role } from "@marketplace/shared";
import { Roles } from "../../common/decorators/roles.decorator";
import { AdminService } from "./admin.service";

@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Roles(Role.ADMIN)
  @Get("stats")
  getStats(): Promise<AdminStatsDto> {
    return this.admin.getStats();
  }
}

import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ReportDto, Role } from "@marketplace/shared";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/jwt-payload.type";
import { ReportsService } from "./reports.service";
import { CreateReportDto } from "./dto/create-report.dto";
import { ResolveReportDto } from "./dto/resolve-report.dto";

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post("reports")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto): Promise<ReportDto> {
    return this.reports.create(user.id, dto);
  }

  @Roles(Role.ADMIN)
  @Get("admin/reports")
  findAllForAdmin(): Promise<ReportDto[]> {
    return this.reports.findAllForAdmin();
  }

  @Roles(Role.ADMIN)
  @Post("admin/reports/:id/resolve")
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ResolveReportDto,
  ): Promise<ReportDto> {
    return this.reports.resolve(user.id, id, dto.outcome);
  }
}

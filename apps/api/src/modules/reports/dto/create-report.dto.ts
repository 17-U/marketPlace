import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { ReportReason } from "@marketplace/shared";

export class CreateReportDto {
  @IsUUID()
  listingId!: string;

  @IsEnum(ReportReason)
  reason!: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

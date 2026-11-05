import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class ResolveDisputeDto {
  @IsIn(["RELEASE", "REFUND"])
  outcome!: "RELEASE" | "REFUND";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNote?: string;
}

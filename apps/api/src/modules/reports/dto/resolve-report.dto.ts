import { IsIn } from "class-validator";

export class ResolveReportDto {
  @IsIn(["DISMISS", "ACTION"])
  outcome!: "DISMISS" | "ACTION";
}

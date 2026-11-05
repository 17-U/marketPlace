import { IsString, MaxLength, MinLength } from "class-validator";

export class OpenDisputeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description!: string;
}

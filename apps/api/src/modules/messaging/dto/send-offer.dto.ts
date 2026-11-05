import { IsInt, Max, Min } from "class-validator";

export class SendOfferDto {
  @IsInt()
  @Min(100)
  @Max(50_000_000)
  amountXaf!: number;
}

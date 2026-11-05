import { IsBoolean, IsUUID } from "class-validator";

export class RespondOfferDto {
  @IsUUID()
  messageId!: string;

  @IsBoolean()
  accept!: boolean;
}

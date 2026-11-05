import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { DeliveryMethod } from "@marketplace/shared";

export class CreateOrderDto {
  @IsUUID()
  listingId!: string;

  @IsEnum(DeliveryMethod)
  deliveryMethod!: DeliveryMethod;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  recipientName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  recipientPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  deliveryAddressText?: string;
}

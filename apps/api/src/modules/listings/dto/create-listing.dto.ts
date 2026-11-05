import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ListingCondition } from "@marketplace/shared";

export class CreateListingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  description!: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  size?: string;

  @IsEnum(ListingCondition)
  condition!: ListingCondition;

  @IsInt()
  @Min(100)
  @Max(50_000_000)
  priceXaf!: number;

  @IsUUID()
  cityId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  neighborhood?: string;
}

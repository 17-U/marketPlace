import { Type } from "class-transformer";
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { ListingCondition } from "@marketplace/shared";

export class SearchListingsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @IsEnum(ListingCondition)
  condition?: ListingCondition;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPriceXaf?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPriceXaf?: number;

  @IsOptional()
  @IsIn(["recent", "price_asc", "price_desc"])
  sort?: "recent" | "price_asc" | "price_desc";

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

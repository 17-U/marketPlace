import { IsOptional, IsString, Length, Matches, MaxLength, MinLength } from "class-validator";
import { CAMEROON_PHONE_REGEX } from "@marketplace/shared";

export class VerifyOtpDto {
  @Matches(CAMEROON_PHONE_REGEX, {
    message: "Le numéro doit être un numéro camerounais valide, ex: +237600000000",
  })
  phone!: string;

  @IsString()
  @Length(6, 6, { message: "Le code doit contenir 6 chiffres" })
  code!: string;

  // Requis uniquement lors de la première connexion (création de compte).
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;
}

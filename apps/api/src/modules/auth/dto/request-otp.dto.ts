import { Matches } from "class-validator";
import { CAMEROON_PHONE_REGEX } from "@marketplace/shared";

export class RequestOtpDto {
  @Matches(CAMEROON_PHONE_REGEX, {
    message: "Le numéro doit être un numéro camerounais valide, ex: +237600000000",
  })
  phone!: string;
}

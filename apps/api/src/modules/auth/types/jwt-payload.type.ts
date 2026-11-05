import { Role } from "@marketplace/shared";

export interface JwtPayload {
  sub: string;
  role: Role;
}

export interface AuthenticatedUser {
  id: string;
  role: Role;
}

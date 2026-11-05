import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ListingSummaryDto } from "@marketplace/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/jwt-payload.type";
import { FavoritesService } from "./favorites.service";

@Controller()
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Post("listings/:id/favorite")
  @HttpCode(HttpStatus.NO_CONTENT)
  async add(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.favorites.add(user.id, id);
  }

  @Delete("listings/:id/favorite")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.favorites.remove(user.id, id);
  }

  @Get("me/favorites")
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<ListingSummaryDto[]> {
    return this.favorites.findMine(user.id);
  }
}

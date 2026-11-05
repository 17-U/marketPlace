import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  AdminListingSummaryDto,
  ListingDetailDto,
  ListingSummaryDto,
  PaginatedResult,
  Role,
} from "@marketplace/shared";
import { IsString, MaxLength, MinLength } from "class-validator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/jwt-payload.type";
import { ListingsService } from "./listings.service";
import { SearchService } from "../search/search.service";
import { CreateListingDto } from "./dto/create-listing.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";
import { SearchListingsDto } from "./dto/search-listings.dto";

class ModerateListingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

@Controller()
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly search: SearchService,
  ) {}

  @Public()
  @Get("listings")
  searchListings(@Query() query: SearchListingsDto): Promise<PaginatedResult<ListingSummaryDto>> {
    return this.search.searchListings(query);
  }

  @Public()
  @Get("listings/:id")
  getPublicListing(@Param("id") id: string): Promise<ListingDetailDto> {
    return this.listings.findPublicById(id);
  }

  // Limite la création d'annonces (anti-spam) sans gêner un vendeur normal.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("listings")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateListingDto,
  ): Promise<ListingDetailDto> {
    return this.listings.create(user.id, dto);
  }

  @Patch("listings/:id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateListingDto,
  ): Promise<ListingDetailDto> {
    return this.listings.update(user.id, id, dto);
  }

  @Post("listings/:id/publish")
  publish(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<ListingDetailDto> {
    return this.listings.publish(user.id, id);
  }

  @Post("listings/:id/hide")
  hide(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<ListingDetailDto> {
    return this.listings.hide(user.id, id);
  }

  @Post("listings/:id/sold")
  markSold(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<ListingDetailDto> {
    return this.listings.markSold(user.id, id);
  }

  @Delete("listings/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.listings.softDelete(user.id, id);
  }

  @Get("me/listings")
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<ListingSummaryDto[]> {
    return this.listings.findMine(user.id);
  }

  @Get("me/listings/:id")
  findOwned(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<ListingDetailDto> {
    return this.listings.findOwned(user.id, id);
  }

  @Roles(Role.ADMIN)
  @Get("admin/listings")
  findAllForAdmin(): Promise<AdminListingSummaryDto[]> {
    return this.listings.findAllForAdmin();
  }

  @Roles(Role.ADMIN)
  @Post("admin/listings/:id/hide")
  moderateHide(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ModerateListingDto,
  ): Promise<ListingDetailDto> {
    return this.listings.moderateHide(user.id, id, dto.reason);
  }
}

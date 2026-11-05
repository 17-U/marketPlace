import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { OrderDetailDto, OrderSummaryDto, Role } from "@marketplace/shared";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/jwt-payload.type";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ShipOrderDto } from "./dto/ship-order.dto";

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post("orders")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderDetailDto> {
    return this.orders.create(user.id, dto);
  }

  @Get("me/orders/buying")
  findMineAsBuyer(@CurrentUser() user: AuthenticatedUser): Promise<OrderSummaryDto[]> {
    return this.orders.findMineAsBuyer(user.id);
  }

  @Get("me/orders/selling")
  findMineAsSeller(@CurrentUser() user: AuthenticatedUser): Promise<OrderSummaryDto[]> {
    return this.orders.findMineAsSeller(user.id);
  }

  @Get("orders/:id")
  findById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<OrderDetailDto> {
    return this.orders.findById(user.id, id, user.role === Role.ADMIN);
  }

  @Post("orders/:id/ship")
  ship(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ShipOrderDto,
  ): Promise<OrderDetailDto> {
    return this.orders.ship(user.id, id, dto.trackingNumber);
  }

  @Post("orders/:id/confirm-delivery")
  confirmDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<OrderDetailDto> {
    return this.orders.confirmDelivery(user.id, id);
  }

  @Post("orders/:id/cancel")
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<OrderDetailDto> {
    return this.orders.cancel(user.id, id);
  }

  // L'ouverture et la résolution de litige passent désormais par DisputesController
  // (/orders/:id/dispute, /disputes/:id/resolve), qui enrichit la transition de
  // statut ci-dessous (OrdersService.markDisputed/resolveDispute) avec l'entité
  // Dispute (motif détaillé, photos, fil de discussion).

  @Public()
  @Post("payments/webhook")
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-signature") signature: string | undefined,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody?.toString("utf8") ?? "";
    await this.orders.handleWebhook(rawBody, signature);
    return { received: true };
  }
}

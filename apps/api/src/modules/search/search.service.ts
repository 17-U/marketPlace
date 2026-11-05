import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ListingCondition, ListingSummaryDto, PaginatedResult } from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";

export interface ListingSearchParams {
  q?: string;
  categoryId?: string;
  cityId?: string;
  condition?: ListingCondition;
  minPriceXaf?: number;
  maxPriceXaf?: number;
  sort?: "recent" | "price_asc" | "price_desc";
  cursor?: string;
  limit?: number;
}

interface RawListingRow {
  id: string;
  title: string;
  priceXaf: number;
  condition: ListingCondition;
  status: string;
  cityId: string;
  cityNameFr: string;
  neighborhood: string | null;
  createdAt: Date;
  coverPhotoUrl: string | null;
}

interface Cursor {
  createdAt: string;
  priceXaf: number;
  id: string;
}

const DEFAULT_LIMIT = 20;

// Façade de recherche: implémentation Postgres (recherche plein texte + filtres) isolée ici
// pour pouvoir être remplacée par Meilisearch plus tard sans changer les appelants.
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchListings(params: ListingSearchParams): Promise<PaginatedResult<ListingSummaryDto>> {
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, 50);
    const sort = params.sort ?? "recent";
    const cursor = params.cursor ? this.decodeCursor(params.cursor) : null;

    const conditions: Prisma.Sql[] = [Prisma.sql`l.status = 'PUBLISHED'`, Prisma.sql`l."deletedAt" IS NULL`];

    if (params.q && params.q.trim().length > 0) {
      conditions.push(
        Prisma.sql`to_tsvector('french', l.title || ' ' || l.description) @@ websearch_to_tsquery('french', ${params.q})`,
      );
    }
    if (params.categoryId) {
      conditions.push(Prisma.sql`l."categoryId" = ${params.categoryId}`);
    }
    if (params.cityId) {
      conditions.push(Prisma.sql`l."cityId" = ${params.cityId}`);
    }
    if (params.condition) {
      conditions.push(Prisma.sql`l.condition = ${params.condition}::"ListingCondition"`);
    }
    if (params.minPriceXaf !== undefined) {
      conditions.push(Prisma.sql`l."priceXaf" >= ${params.minPriceXaf}`);
    }
    if (params.maxPriceXaf !== undefined) {
      conditions.push(Prisma.sql`l."priceXaf" <= ${params.maxPriceXaf}`);
    }

    if (cursor) {
      if (sort === "price_asc") {
        conditions.push(Prisma.sql`(l."priceXaf", l.id) > (${cursor.priceXaf}, ${cursor.id})`);
      } else if (sort === "price_desc") {
        conditions.push(Prisma.sql`(l."priceXaf", l.id) < (${cursor.priceXaf}, ${cursor.id})`);
      } else {
        conditions.push(
          Prisma.sql`(l."createdAt", l.id) < (${new Date(cursor.createdAt)}, ${cursor.id})`,
        );
      }
    }

    const orderBy =
      sort === "price_asc"
        ? Prisma.sql`l."priceXaf" ASC, l.id ASC`
        : sort === "price_desc"
          ? Prisma.sql`l."priceXaf" DESC, l.id DESC`
          : Prisma.sql`l."createdAt" DESC, l.id DESC`;

    const whereClause = Prisma.join(conditions, " AND ");

    const rows = await this.prisma.$queryRaw<RawListingRow[]>(Prisma.sql`
      SELECT
        l.id,
        l.title,
        l."priceXaf",
        l.condition,
        l.status,
        l."cityId",
        c."nameFr" AS "cityNameFr",
        l.neighborhood,
        l."createdAt",
        (
          SELECT p."thumbUrl" FROM "ListingPhoto" p
          WHERE p."listingId" = l.id
          ORDER BY p.position ASC
          LIMIT 1
        ) AS "coverPhotoUrl"
      FROM "Listing" l
      JOIN "City" c ON c.id = l."cityId"
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limit + 1}
    `);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor = hasMore
      ? this.encodeCursor({
          createdAt: page[page.length - 1].createdAt.toISOString(),
          priceXaf: page[page.length - 1].priceXaf,
          id: page[page.length - 1].id,
        })
      : null;

    return {
      items: page.map((row) => this.toSummaryDto(row)),
      nextCursor,
    };
  }

  private toSummaryDto(row: RawListingRow): ListingSummaryDto {
    return {
      id: row.id,
      title: row.title,
      priceXaf: row.priceXaf,
      condition: row.condition,
      status: row.status as ListingSummaryDto["status"],
      cityId: row.cityId,
      cityNameFr: row.cityNameFr,
      neighborhood: row.neighborhood,
      coverPhotoUrl: row.coverPhotoUrl,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private encodeCursor(cursor: Cursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString("base64url");
  }

  private decodeCursor(encoded: string): Cursor | null {
    try {
      return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    } catch {
      return null;
    }
  }
}

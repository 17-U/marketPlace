import { Injectable } from "@nestjs/common";
import { City } from "@prisma/client";
import { CityDto } from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<City[]> {
    return this.prisma.city.findMany({ orderBy: { nameFr: "asc" } });
  }

  findById(id: string): Promise<City | null> {
    return this.prisma.city.findUnique({ where: { id } });
  }

  toDto(city: City): CityDto {
    return {
      id: city.id,
      nameFr: city.nameFr,
      nameEn: city.nameEn,
      region: city.region,
    };
  }
}

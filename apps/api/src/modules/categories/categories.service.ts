import { Injectable } from "@nestjs/common";
import { Category } from "@prisma/client";
import { CategoryDto } from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { nameFr: "asc" } });
  }

  findById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { id } });
  }

  toDto(category: Category): CategoryDto {
    return {
      id: category.id,
      slug: category.slug,
      nameFr: category.nameFr,
      nameEn: category.nameEn,
      icon: category.icon,
      parentId: category.parentId,
    };
  }
}

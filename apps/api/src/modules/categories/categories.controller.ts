import { Controller, Get } from "@nestjs/common";
import { CategoryDto } from "@marketplace/shared";
import { Public } from "../../common/decorators/public.decorator";
import { CategoriesService } from "./categories.service";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  async findAll(): Promise<CategoryDto[]> {
    const categories = await this.categories.findAll();
    return categories.map((category) => this.categories.toDto(category));
  }
}

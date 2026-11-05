import { Controller, Get } from "@nestjs/common";
import { CityDto } from "@marketplace/shared";
import { Public } from "../../common/decorators/public.decorator";
import { CitiesService } from "./cities.service";

@Controller("cities")
export class CitiesController {
  constructor(private readonly cities: CitiesService) {}

  @Public()
  @Get()
  async findAll(): Promise<CityDto[]> {
    const cities = await this.cities.findAll();
    return cities.map((city) => this.cities.toDto(city));
  }
}

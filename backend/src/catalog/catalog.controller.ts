import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { PasscodeGuard } from '../auth/auth.guard';

@Controller('catalog')
@UseGuards(PasscodeGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  products(@Query('search') search?: string, @Query('line') line?: string, @Query('productType') productType?: string, @Query('lengthIn') lengthIn?: string) {
    return this.catalog.listProducts({ search, line, productType, lengthIn });
  }
}

import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogImportService } from './catalog-import.service';
import { AuthModule } from '../auth/auth.module';

@Module({ imports: [AuthModule], controllers: [CatalogController], providers: [CatalogService, CatalogImportService], exports: [CatalogService, CatalogImportService] })
export class CatalogModule {}

import { Injectable } from '@nestjs/common';

export type CatalogProduct = {
  id: string;
  name: string;
  productType: string;
  tags: string[];
  variants: Array<{ id: string; name: string; sku: string }>;
};

@Injectable()
export class CatalogService {
  listProducts(): CatalogProduct[] {
    return [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Expo Straight Bundle',
        productType: 'bundle',
        tags: ['expo', 'straight'],
        variants: [{ id: '21111111-1111-4111-8111-111111111111', name: '18 inch', sku: 'EXPO-STRAIGHT-18' }],
      },
      {
        id: '11111111-1111-4111-8111-222222222222',
        name: 'Demo Wave Bundle',
        productType: 'bundle',
        tags: ['expo', 'wave'],
        variants: [{ id: '21111111-1111-4111-8111-222222222222', name: '20 inch', sku: 'EXPO-WAVE-20' }],
      },
    ];
  }
}

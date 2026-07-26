import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { CHECKOUT_LIMITS } from '../checkout-intake/request-limits';

class PreviewItemDto {
  @IsUUID() productId!: string;
  @IsOptional() @IsUUID() variantId?: string;
  @IsInt() @Min(1) @Max(CHECKOUT_LIMITS.maxQuantity) quantity!: number;
  @IsOptional() @IsInt() @Min(0) @Max(CHECKOUT_LIMITS.maxWeightGrams) weightGrams?: number;
  @IsOptional() @IsString() @MaxLength(CHECKOUT_LIMITS.maxColorLength) color?: string;
  @IsOptional() @IsInt() @Min(0) @Max(CHECKOUT_LIMITS.maxLengthInches) lengthInches?: number;
}

export class OrderPreviewDto {
  @IsString() @Length(3, 3) currency!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(CHECKOUT_LIMITS.maxItems) @ValidateNested({ each: true }) @Type(() => PreviewItemDto)
  items!: PreviewItemDto[];
}

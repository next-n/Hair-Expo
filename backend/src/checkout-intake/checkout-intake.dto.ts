import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { CHECKOUT_LIMITS } from './request-limits';

export class CheckoutIntakeItemDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsBoolean()
  blonde?: boolean;

  @IsInt()
  @Min(1)
  @Max(CHECKOUT_LIMITS.maxQuantity)
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(CHECKOUT_LIMITS.maxWeightGrams)
  weightGrams?: number;

  @IsOptional()
  @IsString()
  @MaxLength(CHECKOUT_LIMITS.maxColorLength)
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(CHECKOUT_LIMITS.maxLengthInches)
  lengthInches?: number;
}

export class CheckoutIntakeRequestDto {
  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CHECKOUT_LIMITS.maxItems)
  @ValidateNested({ each: true })
  @Type(() => CheckoutIntakeItemDto)
  items!: CheckoutIntakeItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerContact?: string;

  @IsOptional()
  @IsBoolean()
  expoDiscountEnabled?: boolean;
}

import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Length, Min, ValidateNested } from 'class-validator';

export class CheckoutIntakeItemDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lengthInches?: number;
}

export class CheckoutIntakeRequestDto {
  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutIntakeItemDto)
  items!: CheckoutIntakeItemDto[];
}

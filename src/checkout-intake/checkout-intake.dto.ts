import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, IsUUID, Length, Min, ValidateNested } from 'class-validator';

export class CheckoutIntakeItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
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

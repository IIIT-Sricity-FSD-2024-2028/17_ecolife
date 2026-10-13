import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { OptionalText, RequiredText } from '../../common/validation/validators';

export class ProposeAmendmentDto {
  @ApiProperty({ example: 'Utility issued a corrected invoice.' })
  @RequiredText(1000, 'A reason is required to propose an amendment')
  reason!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'Proposed quantity must be a number' })
  @Min(0.0001, { message: 'Proposed quantity must be greater than 0' })
  @Max(1_000_000_000, { message: 'Proposed quantity is unrealistically large' })
  proposedQuantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Proposed cost must be a number' })
  @Min(0, { message: 'Proposed cost cannot be negative' })
  @Max(1_000_000_000, { message: 'Proposed cost is unrealistically large' })
  proposedCost?: number;
}

export class DecideAmendmentDto {
  @ApiProperty({ required: false })
  @OptionalText(1000)
  comment?: string;
}

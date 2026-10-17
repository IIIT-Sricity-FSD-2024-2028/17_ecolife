import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';
import { IsNotBefore, OptionalText, RequiredText, STRICT_DATE } from '../../common/validation/validators';

export class GenerateReportDto {
  @ApiProperty({ example: 'Q3 2026 Emissions Report' })
  @RequiredText(200, 'Report title is required')
  title!: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString(STRICT_DATE, { message: 'periodStart must be a valid date' })
  periodStart!: string;

  @ApiProperty({ example: '2026-09-30' })
  @IsDateString(STRICT_DATE, { message: 'periodEnd must be a valid date' })
  @IsNotBefore('periodStart', { message: 'Period end cannot be before the start date' })
  periodEnd!: string;

  @ApiProperty({ required: false, description: 'Executive summary, highlights, or caveats' })
  @OptionalText(5000)
  notes?: string;
}

export class UpdateReportDto {
  @ApiProperty({ required: false, example: 'Q3 2026 Emissions Report' })
  @OptionalText(200)
  title?: string;

  @ApiProperty({ required: false, example: '2026-07-01' })
  @OptionalText(50)
  periodStart?: string;

  @ApiProperty({ required: false, example: '2026-09-30' })
  @OptionalText(50)
  periodEnd?: string;

  @ApiProperty({ required: false, description: 'Executive summary, highlights, or caveats' })
  @OptionalText(5000)
  notes?: string;

  @ApiProperty({ required: false, description: 'Context for the approver.' })
  @OptionalText(1000)
  submissionNote?: string;
}

export class SubmitReportDto {
  @ApiProperty({ required: false, description: 'Context for the approver.' })
  @OptionalText(1000)
  note?: string;
}

export class ReportDecisionDto {
  @ApiProperty({ required: false })
  @OptionalText(1000)
  comment?: string;
}

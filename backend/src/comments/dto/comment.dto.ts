import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import { RequiredText } from '../../common/validation/validators';

export const COMMENT_ENTITY_TYPES = ['resource_record', 'report', 'amendment'] as const;
export type CommentEntity = (typeof COMMENT_ENTITY_TYPES)[number];

export class CommentTargetDto {
  @ApiProperty({ enum: COMMENT_ENTITY_TYPES })
  @IsIn(COMMENT_ENTITY_TYPES as unknown as string[], { message: 'Unknown item type' })
  entityType!: CommentEntity;

  @ApiProperty()
  @IsUUID('4', { message: 'entityId must be a valid UUID' })
  entityId!: string;
}

export class CreateCommentDto extends CommentTargetDto {
  @ApiProperty({ example: 'Could you re-upload the March bill? The total is cut off.' })
  @RequiredText(1000, 'Write a comment first')
  body!: string;
}

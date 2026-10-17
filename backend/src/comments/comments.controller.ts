import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OrgAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { CommentsService } from './comments.service';
import { CommentTargetDto, CreateCommentDto } from './dto/comment.dto';

@ApiTags('Comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  @Get()
  @OrgAuth()
  @ApiOperation({ summary: 'List the comment thread on a record, report or amendment you can access' })
  list(@CurrentUser() user: AuthenticatedOrgUser, @Query() target: CommentTargetDto) {
    return this.service.list(user, target);
  }

  @Post()
  @OrgAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Add a comment to a record, report or amendment you can access' })
  create(@CurrentUser() user: AuthenticatedOrgUser, @Body() dto: CreateCommentDto) {
    const comment = this.service.create(user, dto);
    return { message: 'Comment posted.', data: comment };
  }
}

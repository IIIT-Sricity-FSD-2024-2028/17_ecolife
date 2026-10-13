import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Verifies an org-portal JWT (Org Admin, Contributor, Reviewer, Executive). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UpdateUserDto, UserDto } from '../common/base.dto';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
@ApiHeader({ name: 'x-role', description: 'Super User for full CRUD; COO can read staff.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Get() @Roles('Super User', 'COO') list() { return ok('Users loaded.', this.usersService.list()); }
  @Get(':id') @Roles('Super User', 'COO') find(@Param('id') id: string) { return ok('User loaded.', this.usersService.find(id)); }
  @Post() @Roles('Super User', 'COO') @ApiOperation({ summary: 'Create user account.' }) create(@Body() dto: UserDto) { return ok('User created.', this.usersService.create(dto)); }
  @Patch(':id') @Roles('Super User', 'COO', 'Manager', 'Analyst') update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Headers('x-role') role: string, @Headers('x-user-id') actorId?: string) { return ok('User updated.', this.usersService.update(id, dto, role, actorId)); }
  @Put(':id') @Roles('Super User', 'COO', 'Manager', 'Analyst') replace(@Param('id') id: string, @Body() dto: UpdateUserDto, @Headers('x-role') role: string, @Headers('x-user-id') actorId?: string) { return ok('User updated.', this.usersService.update(id, dto, role, actorId)); }
  @Delete(':id') @Roles('Super User', 'COO') remove(@Param('id') id: string) { return ok('User deleted.', this.usersService.remove(id)); }
}

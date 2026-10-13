import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsEmailAddress } from '../../common/validation/validators';

export class LoginDto {
  @ApiProperty({ example: 'owner@demo.tropos.dev' })
  @IsEmailAddress()
  email!: string;

  // Sign-in only checks presence and a sane cap; password strength is enforced when one is set.
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MaxLength(128, { message: 'Password is too long' })
  password!: string;
}

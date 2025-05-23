import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password - minimum 8 characters',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, {
    message: 'Password must be at least 8 characters long',
  })
  password: string;
}
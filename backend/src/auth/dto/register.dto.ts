import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nom: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  motDePasse: string;
}
// C:\Users\MSI\Desktop\Projet\pfe-project\backend\src\auth\dto\verify-otp.dto.ts

import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  otp: string;
}
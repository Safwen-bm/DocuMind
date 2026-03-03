import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  nom: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
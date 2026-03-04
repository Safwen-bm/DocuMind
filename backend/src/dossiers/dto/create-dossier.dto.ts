import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateDossierDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nom: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}
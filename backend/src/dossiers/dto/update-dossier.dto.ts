import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateDossierDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nom: string;
}
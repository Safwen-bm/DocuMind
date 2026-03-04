import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  titre?: string;

  @IsOptional()
  contenu?: any;

  @IsOptional()
  @IsBoolean()
  estFavori?: boolean;
}
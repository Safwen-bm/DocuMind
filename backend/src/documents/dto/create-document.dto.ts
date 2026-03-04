import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateDocumentDto {
  @IsOptional()
  @IsString()
  titre?: string;

  @IsOptional()
  @IsUUID()
  dossierId?: string;
}
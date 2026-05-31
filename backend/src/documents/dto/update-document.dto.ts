// src/documents/dto/update-document.dto.ts

import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  titre?: string;

  @IsOptional()
  @IsObject()
  contenu?: any;
}
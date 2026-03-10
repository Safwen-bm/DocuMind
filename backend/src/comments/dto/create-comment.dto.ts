// src/comments/dto/create-comment.dto.ts

import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1, { message: 'Le commentaire ne peut pas être vide.' })
  @MaxLength(2000, { message: 'Le commentaire ne peut pas dépasser 2000 caractères.' })
  contenu: string;
}
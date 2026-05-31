// C:\Users\MSI\Desktop\Projet\pfe-project\backend\src\auth\jwt.guard.ts

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {}
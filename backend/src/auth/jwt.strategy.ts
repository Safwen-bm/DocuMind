// C:\Users\MSI\Desktop\Projet\pfe-project\backend\src\auth\jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Try cookie first
        (req: Request) => req?.cookies?.access_token ?? null,
        // 2. Fallback to Bearer header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.estActif) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
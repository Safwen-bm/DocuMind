// C:\Users\MSI\Desktop\Projet\pfe-project\backend\src\auth\workspace-role.guard.ts

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const RequireRole = (...roles: Role[]) =>
  Reflect.metadata(ROLES_KEY, roles);

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<Role[]>(
      ROLES_KEY,
      context.getHandler(),
    );
    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const workspaceId = request.params?.id;

    if (!userId || !workspaceId) throw new ForbiddenException();

    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: {
          utilisateurId: userId,
          workspaceId,
        },
      },
    });

    if (!membre) throw new NotFoundException('Workspace introuvable.');

    const roleHierarchy: Role[] = [
      Role.LECTEUR,
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ];

    const userRoleIndex = roleHierarchy.indexOf(membre.role);
    const hasRole = requiredRoles.some(
      (r) => userRoleIndex >= roleHierarchy.indexOf(r),
    );

    if (!hasRole) throw new ForbiddenException('Permission insuffisante.');

    request.membreRole = membre.role;
    return true;
  }
}
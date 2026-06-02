import { WorkspaceRoleGuard } from './workspace-role.guard';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeMockContext = (
  userId: string | undefined,
  workspaceId: string | undefined,
): ExecutionContext => {
  const request: any = {
    user: userId ? { id: userId } : undefined,
    params: { id: workspaceId },
    membreRole: undefined,
  };
  return {
    getHandler: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
    _request: request,
  } as any;
};

const makeMembre = (role: Role) => ({
  utilisateurId: 'user-1',
  workspaceId: 'ws-1',
  role,
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

const prisma = {
  membreWorkspace: { findUnique: jest.fn() },
};

const reflector = { get: jest.fn() };

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('WorkspaceRoleGuard', () => {
  let guard: WorkspaceRoleGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new WorkspaceRoleGuard(
      reflector as unknown as Reflector,
      prisma as unknown as PrismaService,
    );
  });

  // ── No roles required ─────────────────────────────────────────────────────

  it('returns true when no roles are required (public route)', async () => {
    reflector.get.mockReturnValue(undefined);
    const ctx = makeMockContext('user-1', 'ws-1');
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(prisma.membreWorkspace.findUnique).not.toHaveBeenCalled();
  });

  // ── Missing request data ───────────────────────────────────────────────────

  it('throws ForbiddenException when userId is missing', async () => {
    reflector.get.mockReturnValue([Role.LECTEUR]);
    const ctx = makeMockContext(undefined, 'ws-1');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when workspaceId is missing', async () => {
    reflector.get.mockReturnValue([Role.LECTEUR]);
    const ctx = makeMockContext('user-1', undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // ── Member not found ──────────────────────────────────────────────────────

  it('throws NotFoundException when user is not a member of the workspace', async () => {
    reflector.get.mockReturnValue([Role.LECTEUR]);
    prisma.membreWorkspace.findUnique.mockResolvedValue(null);
    const ctx = makeMockContext('user-1', 'ws-1');
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  // ── Role hierarchy ────────────────────────────────────────────────────────

  it('allows LECTEUR to access a route requiring LECTEUR', async () => {
    reflector.get.mockReturnValue([Role.LECTEUR]);
    prisma.membreWorkspace.findUnique.mockResolvedValue(makeMembre(Role.LECTEUR));
    const ctx = makeMockContext('user-1', 'ws-1');
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('allows EDITEUR to access a route requiring LECTEUR', async () => {
    reflector.get.mockReturnValue([Role.LECTEUR]);
    prisma.membreWorkspace.findUnique.mockResolvedValue(makeMembre(Role.EDITEUR));
    const ctx = makeMockContext('user-1', 'ws-1');
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('allows PROPRIETAIRE to access a route requiring ADMINISTRATEUR', async () => {
    reflector.get.mockReturnValue([Role.ADMINISTRATEUR]);
    prisma.membreWorkspace.findUnique.mockResolvedValue(
      makeMembre(Role.PROPRIETAIRE),
    );
    const ctx = makeMockContext('user-1', 'ws-1');
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('denies LECTEUR from a route requiring EDITEUR', async () => {
    reflector.get.mockReturnValue([Role.EDITEUR]);
    prisma.membreWorkspace.findUnique.mockResolvedValue(makeMembre(Role.LECTEUR));
    const ctx = makeMockContext('user-1', 'ws-1');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('denies EDITEUR from a route requiring ADMINISTRATEUR', async () => {
    reflector.get.mockReturnValue([Role.ADMINISTRATEUR]);
    prisma.membreWorkspace.findUnique.mockResolvedValue(makeMembre(Role.EDITEUR));
    const ctx = makeMockContext('user-1', 'ws-1');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('denies ADMINISTRATEUR from a route requiring PROPRIETAIRE', async () => {
    reflector.get.mockReturnValue([Role.PROPRIETAIRE]);
    prisma.membreWorkspace.findUnique.mockResolvedValue(
      makeMembre(Role.ADMINISTRATEUR),
    );
    const ctx = makeMockContext('user-1', 'ws-1');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // ── Multiple required roles ────────────────────────────────────────────────

  it('allows access when user matches one of multiple required roles', async () => {
    reflector.get.mockReturnValue([Role.ADMINISTRATEUR, Role.PROPRIETAIRE]);
    prisma.membreWorkspace.findUnique.mockResolvedValue(
      makeMembre(Role.ADMINISTRATEUR),
    );
    const ctx = makeMockContext('user-1', 'ws-1');
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  // ── Sets membreRole on request ─────────────────────────────────────────────

  it('sets request.membreRole after successful authorization', async () => {
    reflector.get.mockReturnValue([Role.EDITEUR]);
    prisma.membreWorkspace.findUnique.mockResolvedValue(makeMembre(Role.EDITEUR));
    const ctx = makeMockContext('user-1', 'ws-1');

    await guard.canActivate(ctx);

    const request = ctx.switchToHttp().getRequest();
    expect(request.membreRole).toBe(Role.EDITEUR);
  });
});
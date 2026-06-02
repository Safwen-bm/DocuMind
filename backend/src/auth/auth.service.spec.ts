import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// ── Factories ─────────────────────────────────────────────────────────────────

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  nom: 'Safwen',
  email: 'safwen@example.com',
  motDePasse: '$2b$12$hashedpassword',
  estActif: true,
  tentativesEchec: 0,
  verrouillageJusqua: null,
  avatarUrl: null,
  ...overrides,
});

const makeToken = (overrides = {}) => ({
  id: 'token-1',
  utilisateurId: 'user-1',
  token: 'valid-token-uuid',
  type: 'CONFIRMATION_EMAIL',
  expiration: new Date(Date.now() + 60 * 60 * 1000), // 1h from now
  ...overrides,
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

const prisma = {
  utilisateur: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  tokenVerification: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const jwt = { sign: jest.fn().mockReturnValue('signed-jwt') };

const mail = {
  sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── register ───────────────────────────────────────────────────────────────

  describe('register', () => {
    const dto = {
      nom: 'Safwen',
      email: 'safwen@example.com',
      motDePasse: 'password123',
    };

    it('throws BadRequestException when email already exists', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(makeUser());
      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
      expect(prisma.utilisateur.create).not.toHaveBeenCalled();
    });

    it('hashes the password before saving — never stores plaintext', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(null);
      prisma.utilisateur.create.mockResolvedValue(makeUser());
      prisma.tokenVerification.create.mockResolvedValue({});

      await service.register(dto);

      const createArg = prisma.utilisateur.create.mock.calls[0][0];
      expect(createArg.data.motDePasse).not.toBe(dto.motDePasse);
      expect(createArg.data.motDePasse).toMatch(/^\$2b\$/);
    });

    it('creates a CONFIRMATION_EMAIL token with 24h expiry', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(null);
      prisma.utilisateur.create.mockResolvedValue(makeUser());
      prisma.tokenVerification.create.mockResolvedValue({});

      await service.register(dto);

      const tokenArg = prisma.tokenVerification.create.mock.calls[0][0];
      expect(tokenArg.data.type).toBe('CONFIRMATION_EMAIL');
      // expiry should be roughly 24h from now (within 5s tolerance)
      const diff = tokenArg.data.expiration.getTime() - Date.now();
      expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(diff).toBeLessThan(25 * 60 * 60 * 1000);
    });

    it('sends confirmation email with the generated token', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(null);
      prisma.utilisateur.create.mockResolvedValue(makeUser());
      prisma.tokenVerification.create.mockResolvedValue({});

      await service.register(dto);

      expect(mail.sendConfirmationEmail).toHaveBeenCalledWith(
        makeUser().email,
        expect.any(String),
      );
    });

    it('returns a success message', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(null);
      prisma.utilisateur.create.mockResolvedValue(makeUser());
      prisma.tokenVerification.create.mockResolvedValue({});

      const result = await service.register(dto);
      expect(result).toHaveProperty('message');
    });
  });

  // ── confirmEmail ───────────────────────────────────────────────────────────

  describe('confirmEmail', () => {
    it('throws BadRequestException when token does not exist', async () => {
      prisma.tokenVerification.findUnique.mockResolvedValue(null);
      await expect(service.confirmEmail('bad-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when token is wrong type', async () => {
      prisma.tokenVerification.findUnique.mockResolvedValue(
        makeToken({ type: 'OTP_2FA' }),
      );
      await expect(service.confirmEmail('valid-token-uuid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when token is expired', async () => {
      prisma.tokenVerification.findUnique.mockResolvedValue(
        makeToken({ expiration: new Date(Date.now() - 1000) }),
      );
      await expect(service.confirmEmail('valid-token-uuid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('activates the user (estActif = true)', async () => {
      prisma.tokenVerification.findUnique.mockResolvedValue(makeToken());
      prisma.utilisateur.update.mockResolvedValue({});
      prisma.tokenVerification.delete.mockResolvedValue({});

      await service.confirmEmail('valid-token-uuid');

      expect(prisma.utilisateur.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { estActif: true } }),
      );
    });

    it('deletes the token after activation', async () => {
      prisma.tokenVerification.findUnique.mockResolvedValue(makeToken());
      prisma.utilisateur.update.mockResolvedValue({});
      prisma.tokenVerification.delete.mockResolvedValue({});

      await service.confirmEmail('valid-token-uuid');

      expect(prisma.tokenVerification.delete).toHaveBeenCalledWith({
        where: { token: 'valid-token-uuid' },
      });
    });
  });

  // ── login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    const dto = { email: 'safwen@example.com', motDePasse: 'password123' };

    it('throws UnauthorizedException when user not found', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when account is locked', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(
        makeUser({ verrouillageJusqua: new Date(Date.now() + 10 * 60 * 1000) }),
      );
      await expect(service.login(dto)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when account is not active', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(
        makeUser({ estActif: false }),
      );
      await expect(service.login(dto)).rejects.toThrow(ForbiddenException);
    });

    it('throws UnauthorizedException and increments tentativesEchec on wrong password', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(
        makeUser({ tentativesEchec: 2 }),
      );
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
      prisma.utilisateur.update.mockResolvedValue({});

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);

      expect(prisma.utilisateur.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tentativesEchec: 3 }),
        }),
      );
    });

    it('locks the account after 5 failed attempts', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(
        makeUser({ tentativesEchec: 4 }),
      );
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
      prisma.utilisateur.update.mockResolvedValue({});

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);

      const updateArg = prisma.utilisateur.update.mock.calls[0][0];
      expect(updateArg.data.verrouillageJusqua).toBeInstanceOf(Date);
      // lock should be ~15 minutes from now
      const diff = updateArg.data.verrouillageJusqua.getTime() - Date.now();
      expect(diff).toBeGreaterThan(14 * 60 * 1000);
    });

    it('does NOT lock the account before 5 failed attempts', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(
        makeUser({ tentativesEchec: 3 }),
      );
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
      prisma.utilisateur.update.mockResolvedValue({});

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);

      const updateArg = prisma.utilisateur.update.mock.calls[0][0];
      expect(updateArg.data.verrouillageJusqua).toBeUndefined();
    });

    it('resets tentativesEchec to 0 on successful login', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(
        makeUser({ tentativesEchec: 3 }),
      );
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      prisma.utilisateur.update.mockResolvedValue({});
      prisma.tokenVerification.deleteMany.mockResolvedValue({});
      prisma.tokenVerification.create.mockResolvedValue({});

      await service.login(dto);

      expect(prisma.utilisateur.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { tentativesEchec: 0, verrouillageJusqua: null },
        }),
      );
    });

    it('sends OTP email on successful password check', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(makeUser());
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      prisma.utilisateur.update.mockResolvedValue({});
      prisma.tokenVerification.deleteMany.mockResolvedValue({});
      prisma.tokenVerification.create.mockResolvedValue({});

      await service.login(dto);

      expect(mail.sendOtpEmail).toHaveBeenCalledWith(
        makeUser().email,
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('deletes existing OTP before creating a new one', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(makeUser());
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      prisma.utilisateur.update.mockResolvedValue({});
      prisma.tokenVerification.deleteMany.mockResolvedValue({});
      prisma.tokenVerification.create.mockResolvedValue({});

      await service.login(dto);

      expect(prisma.tokenVerification.deleteMany).toHaveBeenCalledWith({
        where: { utilisateurId: 'user-1', type: 'OTP_2FA' },
      });
    });
  });

  // ── verifyOtp ──────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    const dto = { email: 'safwen@example.com', otp: '123456' };

    it('throws UnauthorizedException when user not found', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(null);
      await expect(service.verifyOtp(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when OTP record not found', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(makeUser());
      prisma.tokenVerification.findFirst.mockResolvedValue(null);
      await expect(service.verifyOtp(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException and deletes token when OTP is expired', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(makeUser());
      prisma.tokenVerification.findFirst.mockResolvedValue(
        makeToken({ type: 'OTP_2FA', expiration: new Date(Date.now() - 1000) }),
      );
      prisma.tokenVerification.delete.mockResolvedValue({});

      await expect(service.verifyOtp(dto)).rejects.toThrow(UnauthorizedException);
      expect(prisma.tokenVerification.delete).toHaveBeenCalled();
    });

    it('returns accessToken and user info on valid OTP', async () => {
      const user = makeUser();
      prisma.utilisateur.findUnique.mockResolvedValue(user);
      prisma.tokenVerification.findFirst.mockResolvedValue(
        makeToken({ type: 'OTP_2FA' }),
      );
      prisma.tokenVerification.delete.mockResolvedValue({});

      const result = await service.verifyOtp(dto);

      expect(result).toHaveProperty('accessToken', 'signed-jwt');
      expect(result.user).toMatchObject({
        id: user.id,
        nom: user.nom,
        email: user.email,
        avatarUrl: user.avatarUrl,
      });
    });

    it('signs JWT with correct payload', async () => {
      const user = makeUser();
      prisma.utilisateur.findUnique.mockResolvedValue(user);
      prisma.tokenVerification.findFirst.mockResolvedValue(
        makeToken({ type: 'OTP_2FA' }),
      );
      prisma.tokenVerification.delete.mockResolvedValue({});

      await service.verifyOtp(dto);

      expect(jwt.sign).toHaveBeenCalledWith({ sub: user.id, email: user.email });
    });

    it('deletes the OTP token after successful verification', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(makeUser());
      prisma.tokenVerification.findFirst.mockResolvedValue(
        makeToken({ type: 'OTP_2FA' }),
      );
      prisma.tokenVerification.delete.mockResolvedValue({});

      await service.verifyOtp(dto);

      expect(prisma.tokenVerification.delete).toHaveBeenCalledWith({
        where: { id: 'token-1' },
      });
    });
  });

  // ── forgotPassword ─────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('returns same success message even if email does not exist — no enumeration', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('unknown@example.com');

      expect(result).toHaveProperty('message');
      expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('sends reset email when user exists', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(makeUser());
      prisma.tokenVerification.deleteMany.mockResolvedValue({});
      prisma.tokenVerification.create.mockResolvedValue({});

      await service.forgotPassword('safwen@example.com');

      expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith(
        makeUser().email,
        expect.any(String),
      );
    });

    it('deletes any previous reset token before creating a new one', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(makeUser());
      prisma.tokenVerification.deleteMany.mockResolvedValue({});
      prisma.tokenVerification.create.mockResolvedValue({});

      await service.forgotPassword('safwen@example.com');

      expect(prisma.tokenVerification.deleteMany).toHaveBeenCalledWith({
        where: { utilisateurId: 'user-1', type: 'RESET_MOT_DE_PASSE' },
      });
    });

    it('creates reset token with 1h expiry', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(makeUser());
      prisma.tokenVerification.deleteMany.mockResolvedValue({});
      prisma.tokenVerification.create.mockResolvedValue({});

      await service.forgotPassword('safwen@example.com');

      const tokenArg = prisma.tokenVerification.create.mock.calls[0][0];
      expect(tokenArg.data.type).toBe('RESET_MOT_DE_PASSE');
      const diff = tokenArg.data.expiration.getTime() - Date.now();
      expect(diff).toBeGreaterThan(59 * 60 * 1000);
      expect(diff).toBeLessThan(61 * 60 * 1000);
    });
  });

  // ── resetPassword ──────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('throws BadRequestException for non-existent token', async () => {
      prisma.tokenVerification.findUnique.mockResolvedValue(null);
      await expect(service.resetPassword('bad', 'newpass123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when token type is wrong', async () => {
      prisma.tokenVerification.findUnique.mockResolvedValue(
        makeToken({ type: 'OTP_2FA' }),
      );
      await expect(
        service.resetPassword('valid-token-uuid', 'newpass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when token is expired', async () => {
      prisma.tokenVerification.findUnique.mockResolvedValue(
        makeToken({
          type: 'RESET_MOT_DE_PASSE',
          expiration: new Date(Date.now() - 1000),
        }),
      );
      await expect(
        service.resetPassword('valid-token-uuid', 'newpass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('hashes the new password before saving', async () => {
      prisma.tokenVerification.findUnique.mockResolvedValue(
        makeToken({ type: 'RESET_MOT_DE_PASSE' }),
      );
      prisma.utilisateur.update.mockResolvedValue({});
      prisma.tokenVerification.delete.mockResolvedValue({});

      await service.resetPassword('valid-token-uuid', 'newpass123');

      const updateArg = prisma.utilisateur.update.mock.calls[0][0];
      expect(updateArg.data.motDePasse).not.toBe('newpass123');
      expect(updateArg.data.motDePasse).toMatch(/^\$2b\$/);
    });

    it('deletes the token after resetting password', async () => {
      prisma.tokenVerification.findUnique.mockResolvedValue(
        makeToken({ type: 'RESET_MOT_DE_PASSE' }),
      );
      prisma.utilisateur.update.mockResolvedValue({});
      prisma.tokenVerification.delete.mockResolvedValue({});

      await service.resetPassword('valid-token-uuid', 'newpass123');

      expect(prisma.tokenVerification.delete).toHaveBeenCalledWith({
        where: { token: 'valid-token-uuid' },
      });
    });
  });
});
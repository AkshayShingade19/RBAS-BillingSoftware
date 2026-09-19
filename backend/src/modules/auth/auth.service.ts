import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { User } from '../users/schemas/user.schema';
import { Session } from './schemas/session.schema';
import { Otp, OtpPurpose } from './schemas/otp.schema';
import { MailService } from '../mail/mail.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RequestOtpDto,
  ResetPasswordDto,
  SignupDto,
  VerifyEmailDto,
} from './dto/auth.dto';

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  sessionId?: string;
  type: 'access' | 'refresh';
}

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const generateOtpCode = (): string => String(Math.floor(100000 + Math.random() * 900000));
const OTP_TTL_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Session.name) private readonly sessionModel: Model<Session>,
    @InjectModel(Otp.name) private readonly otpModel: Model<Otp>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async signup(dto: SignupDto): Promise<{ email: string; message: string }> {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() }).lean().exec();
    if (existing) throw new ConflictException('An account with this email already exists');

    const count = await this.userModel.countDocuments();
    const role = count === 0 ? 'admin' : 'viewer';
    const status = role === 'admin' ? 'active' : 'pending';

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.userModel.create({
      name: dto.name.trim(),
      email: dto.email.toLowerCase(),
      passwordHash,
      role,
      status,
      emailVerified: role === 'admin',
    });

    await this.createAndSendOtp(dto.email.toLowerCase(), 'verify_email');

    return {
      email: dto.email.toLowerCase(),
      message:
        role === 'admin'
          ? 'Workspace created. Verify your email to continue.'
          : 'Account created. Verify your email and wait for an administrator to approve your account.',
    };
  }

  async login(dto: LoginDto, userAgent: string, ip: string) {
    const user = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .select('+passwordHash')
      .lean()
      .exec();

    if (!user) throw new UnauthorizedException('Invalid email or password');

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Invalid email or password');

    if (user.status === 'suspended') {
      throw new ForbiddenException('Account suspended. Contact an administrator.');
    }
    if (!user.emailVerified) {
      throw new ForbiddenException('Email not verified. Please check your inbox for the verification code.');
    }
    if (user.status === 'pending') {
      throw new ForbiddenException('Account pending approval by an administrator.');
    }

    const tokens = await this.issueTokens(String(user._id), {
      name: user.name,
      email: user.email,
      role: user.role,
      userAgent,
      ip,
    });

    await this.userModel.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    return {
      tokens,
      user: this.serializeUser(user),
    };
  }

  async refresh(dto: RefreshDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const session = await this.sessionModel.findOne({ _id: payload.sessionId }).lean().exec();
    if (!session || session.revokedAt) throw new UnauthorizedException('Session revoked');
    if (session.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('Session expired');

    const user = await this.userModel.findById(session.userId).lean().exec();
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Account unavailable');
    }

    await this.sessionModel.updateOne({ _id: session._id }, { $set: { revokedAt: new Date() } });

    const tokens = await this.issueTokens(String(user._id), {
      name: user.name,
      email: user.email,
      role: user.role,
      userAgent: session.userAgent ?? '',
      ip: session.ip ?? '',
    });

    return { tokens, user: this.serializeUser(user) };
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    const payload = await this.verifyRefreshToken(refreshToken);
    await this.sessionModel.updateOne(
      { _id: payload.sessionId },
      { $set: { revokedAt: new Date() } },
    ).exec();
    return { message: 'Logged out' };
  }

  async listSessions(userId: string) {
    const sessions = await this.sessionModel
      .find({ userId: new Types.ObjectId(userId), revokedAt: null })
      .sort({ lastUsedAt: -1 })
      .lean()
      .exec();
    return sessions.map((s) => ({
      id: String(s._id),
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<{ message: string }> {
    await this.sessionModel.updateOne(
      { _id: sessionId, userId: new Types.ObjectId(userId) },
      { $set: { revokedAt: new Date() } },
    ).exec();
    return { message: 'Session revoked' };
  }

  async requestOtp(dto: RequestOtpDto, purpose: OtpPurpose): Promise<{ message: string }> {
    await this.createAndSendOtp(dto.email.toLowerCase(), purpose);
    return { message: 'Verification code sent' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email: dto.email.toLowerCase() }).lean().exec();
    if (!user) throw new NotFoundException('No account found for this email');

    await this.consumeOtp(dto.email.toLowerCase(), 'verify_email', dto.code);

    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { emailVerified: true } },
    ).exec();
    return { message: 'Email verified' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email: dto.email.toLowerCase() }).lean().exec();
    if (!user) throw new NotFoundException('No account found for this email');
    await this.createAndSendOtp(dto.email.toLowerCase(), 'password_reset');
    return { message: 'If the email exists, a reset code has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.consumeOtp(dto.email.toLowerCase(), 'password_reset', dto.code);

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    const user = await this.userModel
      .findOneAndUpdate(
        { email: dto.email.toLowerCase() },
        { $set: { passwordHash } },
        { new: true },
      )
      .lean()
      .exec();

    if (user) {
      await this.sessionModel.updateMany(
        { userId: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      ).exec();
    }

    return { message: 'Password updated' };
  }

  private async createAndSendOtp(email: string, purpose: OtpPurpose): Promise<string> {
    await this.otpModel.updateMany(
      { email, purpose, consumedAt: null },
      { $set: { consumedAt: new Date() } },
    ).exec();

    const code = generateOtpCode();
    await this.otpModel.create({
      email,
      purpose,
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
    await this.mailService.sendOtpCode(email, code, purpose);
    return code;
  }

  private async consumeOtp(email: string, purpose: OtpPurpose, code: string): Promise<void> {
    const otp = await this.otpModel
      .findOne({ email, purpose, consumedAt: null })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!otp) throw new BadRequestException('Invalid or missing verification code');
    if (otp.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification code has expired');
    }
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException('Too many attempts. Request a new code.');
    }
    if (otp.codeHash !== sha256(code)) {
      await this.otpModel.updateOne({ _id: otp._id }, { $inc: { attempts: 1 } }).exec();
      throw new BadRequestException('Invalid verification code');
    }

    await this.otpModel.updateOne(
      { _id: otp._id },
      { $set: { consumedAt: new Date() }, $inc: { attempts: 1 } },
    ).exec();
  }

  private async issueTokens(
    userId: string,
    opts: { name: string; email: string; role: string; userAgent: string; ip: string },
  ) {
    const session = await this.sessionModel.create({
      userId: new Types.ObjectId(userId),
      tokenHash: '', // replaced after refresh token generated below
      userAgent: opts.userAgent.slice(0, 300),
      ip: opts.ip,
      expiresAt: new Date(
        Date.now() +
          this.parseDuration(this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d'),
      ),
      lastUsedAt: new Date(),
    });

    const refreshToken = await this.jwtService.signAsync(
      { ...this.basePayload(userId, opts), sessionId: String(session._id), type: 'refresh' },
      { secret: this.configService.get<string>('jwt.refreshSecret'), expiresIn: '7d' },
    );

    await this.sessionModel.updateOne(
      { _id: session._id },
      { $set: { tokenHash: sha256(refreshToken) } },
    ).exec();

    const accessToken = await this.jwtService.signAsync(
      this.basePayload(userId, opts),
      { secret: this.configService.get<string>('jwt.accessSecret'), expiresIn: '15m' },
    );

    return { accessToken, refreshToken };
  }

  private basePayload(
    userId: string,
    opts: { name: string; email: string; role: string },
  ): TokenPayload {
    return {
      sub: userId,
      email: opts.email,
      role: opts.role,
      name: opts.name,
      type: 'access',
    };
  }

  private async verifyRefreshToken(token: string): Promise<{ sessionId: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        sessionId: string;
        type: string;
      }>(token, { secret: this.configService.get<string>('jwt.refreshSecret') });
      if (payload.type !== 'refresh') throw new Error('Not a refresh token');
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private parseDuration(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return value * multipliers[unit];
  }

  private serializeUser(user: Record<string, unknown>) {
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }
}
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendMailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger('MailService');

  constructor(private readonly configService: ConfigService) {}

  get transport(): 'console' | 'smtp' {
    return this.configService.get<'console' | 'smtp'>('mail.transport') ?? 'console';
  }

  async send(options: SendMailOptions): Promise<void> {
    if (this.transport === 'console') {
      this.logger.log(
        `[${options.to}] ${options.subject}\n${options.text ?? options.html ?? ''}`,
      );
      return;
    }
    // SMTP transport placeholder - plug nodemailer/aws-ses etc. here.
    this.logger.warn(`SMTP transport not configured. Mail to ${options.to} skipped.`);
  }

  sendOtpCode(to: string, code: string, purpose: string): Promise<void> {
    const subject =
      purpose === 'verify_email'
        ? 'Your Ledgerly email verification code'
        : 'Your Ledgerly password reset code';
    const text = `Your Ledgerly verification code is ${code}. It expires in 15 minutes.`;
    return this.send({ to, subject, text });
  }
}
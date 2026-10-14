import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  sendEmail(options: SendEmailOptions): Promise<void>;
  sendOtpEmail(email: string, code: string): Promise<void>;
}

export class SmtpEmailSender implements EmailSender {
  private transporter: Transporter;

  constructor() {
    const host = process.env.SMTP_HOST || 'localhost';
    const port = parseInt(process.env.SMTP_PORT || '1025', 10);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      ignoreTLS: true,
    });
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: '"Line OpenChat Access" <no-reply@openchat.example>',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }

  async sendOtpEmail(email: string, code: string): Promise<void> {
    const subject = 'Your OpenChat verification code';
    const text = [
      `Your verification code is: ${code}`,
      '',
      'This code will expire in 10 minutes.',
      '',
      'If you did not request this verification code, please ignore this email.',
    ].join('\n');

    await this.sendEmail({
      to: email,
      subject,
      text,
    });
  }
}

export const emailSender: EmailSender = new SmtpEmailSender();

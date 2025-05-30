/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
  } from '@nestjs/common';
  import { JwtService } from '@nestjs/jwt';
  import * as bcrypt from 'bcryptjs';
  import { UsersService } from '../users/users.service';
  import { User } from '../users/entities/user.entity';
  import { EmailService } from '../shared/services/email.service';
  import {
    LoginDto,
    LoginResponseDto,
    SignupDto,
    VerifyCodeDto,
    ResetPasswordDto,
  } from './dto';
  import { ChangePasswordDto } from './dto/change-password.dto';
  
  @Injectable()
  export class AuthService {
    constructor(
      private usersService: UsersService,
      private jwtService: JwtService,
      private emailService: EmailService,
    ) {}
  
    async validateUser(email: string, password: string): Promise<any> {
      const user = await this.usersService.findByEmail(email);
      if (user && (await bcrypt.compare(password, user.password))) {
        const { password, ...result } = user;
        return result;
      }
      return null;
    }
  
    async login(
      loginDto: LoginDto,
    ): Promise<LoginResponseDto | { requiresVerification: boolean }> {
      const user = await this.validateUser(loginDto.email, loginDto.password);
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }
  
      // if (!user.isEmailVerified) {
      //   // Generate new verification code
      //   const verificationCode = this.generateVerificationCode();
      //   const verificationCodeExpiresAt = this.getVerificationCodeExpiry();
  
      //   // Update user with new verification code
      //   await this.usersService.update(user.id, {
      //     verificationCode,
      //     verificationCodeExpiresAt,
      //   });
  
      //   // Send new verification code
      //   await this.emailService.sendVerificationCode(
      //     user.email,
      //     verificationCode,
      //   );
  
      //   return {
      //     requiresVerification: true,
      //   };
      // }
  
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
      return {
        access_token: this.generateToken(user),
        expires_at: expiresAt.toISOString(),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isEmailVerified: user.isEmailVerified,
        },
      };
    }
  
    async signup(signupDto: SignupDto) {
      const existingUser = await this.usersService.findByEmail(signupDto.email);
      if (existingUser) {
        throw new BadRequestException('Email already exists');
      }
  
      const hashedPassword = await this.hashPassword(signupDto.password);
  
      const verificationCode = this.generateVerificationCode();
      const verificationCodeExpiresAt = this.getVerificationCodeExpiry();
      const newUser = await this.usersService.create({
        ...signupDto,
        password: hashedPassword,
        verificationCode,
        verificationCodeExpiresAt,
        isEmailVerified: false,
      });
  
      // await this.emailService.sendVerificationCode(
      //   newUser.email,
      //   verificationCode,
      // );
  
      // const { password, verificationCode: code, ...result } = newUser;
      const { password, ...result } = newUser;
  
      return {
        message:
          'User registered successfully.',
        // verificationEmailSent: true,
        user: result,
      };
    }
  
    async verifyEmail(verifyCodeDto: VerifyCodeDto) {
      const user = await this.usersService.findByEmail(verifyCodeDto.email);
  
      if (!user) {
        throw new BadRequestException('User not found');
      }
  
      if (user.isEmailVerified) {
        throw new BadRequestException('Email already verified');
      }
  
      if (
        !user.verificationCode ||
        user.verificationCode !== verifyCodeDto.code
      ) {
        throw new BadRequestException('Invalid verification code');
      }
  
      if (new Date() > user.verificationCodeExpiresAt) {
        throw new BadRequestException('Verification code has expired');
      }
  
      await this.usersService.update(user.id, {
        isEmailVerified: true,
        verificationCode: undefined,
        verificationCodeExpiresAt: undefined,
      });
  
      return {
        message: 'Email verified successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isEmailVerified: true,
        },
      };
    }
  
    async resendVerificationCode(email: string) {
      const user = await this.usersService.findByEmail(email);
  
      if (!user) {
        throw new BadRequestException('User not found');
      }
  
      if (user.isEmailVerified) {
        throw new BadRequestException('Email already verified');
      }
  
      const verificationCode = this.generateVerificationCode();
      const verificationCodeExpiresAt = this.getVerificationCodeExpiry();
  
      await this.usersService.update(user.id, {
        verificationCode,
        verificationCodeExpiresAt,
      });
  
      await this.emailService.sendVerificationCode(email, verificationCode);
  
      return {
        message: 'Verification code sent successfully',
        verificationEmailSent: true,
      };
    }
  
    private async hashPassword(password: string): Promise<string> {
      const salt = await bcrypt.genSalt();
      return bcrypt.hash(password, salt);
    }
  
    private generateVerificationCode(): string {
      return Math.floor(100000 + Math.random() * 900000).toString();
    }
  
    private getVerificationCodeExpiry(): Date {
      const expiryDate = new Date();
      expiryDate.setMinutes(expiryDate.getMinutes() + 15); // Code expires in 15 minutes
      return expiryDate;
    }
  
    private generateToken(user: Partial<User>) {
      const payload = {
        email: user.email,
        sub: user.id,
      };
      return this.jwtService.sign(payload);
    }
  
    async forgotPassword(email: string) {
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        return {
          message:
            // 'If your email is registered, you will receive a password reset code.',
            'The email you entered was not registed!',
        };
      }
  
      // const resetCode = this.generateVerificationCode();
      // const resetCodeExpiresAt = this.getVerificationCodeExpiry();
  
      // await this.usersService.update(user.id, {
      //   passwordResetCode: resetCode,
      //   passwordResetCodeExpiresAt: resetCodeExpiresAt,
      // });
  
      // await this.emailService.sendPasswordResetCode(email, resetCode);
  
      return {
        user_id: user.id,
      };
    }
  
    async resetPassword(resetPasswordDto: ResetPasswordDto) {
      // const user = await this.usersService.findByEmail(resetPasswordDto.email);
      const user = await this.usersService.findById(resetPasswordDto.user_id);
      if (!user) {
        throw new BadRequestException('Invalid reset attempt');
      }
  
      // if (
      //   !user.passwordResetCode ||
      //   user.passwordResetCode !== resetPasswordDto.code ||
      //   new Date() > user.passwordResetCodeExpiresAt
      // ) {
      //   throw new BadRequestException('Invalid or expired reset code');
      // }
  
      const hashedPassword = await this.hashPassword(
        resetPasswordDto.newPassword,
      );
  
      await this.usersService.update(user.id, {
        password: hashedPassword,
        passwordResetCode: undefined,
        passwordResetCodeExpiresAt: undefined,
      });
  
      return {
        message: 'Password reset successfully',
      };
    }
    async getProfile(userId: number) {
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new BadRequestException('Invalid reset attempt');
      }
      return user;
    }
  
    async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
      const user = await this.usersService.findOne(userId);
  
      if (
        !user ||
        !(await bcrypt.compare(changePasswordDto.password, user.password))
      ) {
        throw new BadRequestException('Password is incorrect');
      }
      const hashedNewPassword = await this.hashPassword(
        changePasswordDto.newPassword,
      );
      await this.usersService.update(user.id, {
        password: hashedNewPassword,
      });
    }
  }
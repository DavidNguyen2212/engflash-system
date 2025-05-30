import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto';
import { User } from './entities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto);
    return await this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.usersRepository.find();
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findById(id: number): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { id },
      select: ['id', 'name', 'dateOfBirth', 'email', 'updatedAt'],
    });
  }

  async findByIds(ids: number[]): Promise<User[]> {
    return await this.usersRepository.find({
      where: {
        id: In(ids),
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { email } });
  }

  async findByEmailAndVerificationCode(
    email: string,
    verificationCode: string,
  ): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: {
        email,
        verificationCode,
      },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User | null> {
    await this.usersRepository.update(id, updateUserDto);
    return this.findById(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async updateVerificationCode(
    email: string,
    verificationCode: string,
    expiresAt: Date,
  ): Promise<void> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    await this.usersRepository.update(user.id, {
      verificationCode,
      verificationCodeExpiresAt: expiresAt,
    });
  }

  private mapToUserResponse(user: User, role?: any): UserResponseDto {
    const response = new UserResponseDto();
    response.id = user.id;
    response.name = user.name;
    response.email = user.email;
    response.dateOfBirth = user.dateOfBirth;
    response.createdAt = user.createdAt;
    response.updatedAt = user.updatedAt;
    // if (role) {
    //   response.role = role;
    // }
    return response;
  }

  // async getUserWithRole(
  //   userId: number,
  //   role: UserRoles,
  // ): Promise<UserResponseDto> {
  //   const user = await this.findById(userId);
  //   if (!user) {
  //     throw new NotFoundException(`User with ID ${userId} not found`);
  //   }
  //   return this.mapToUserResponse(user, role);
  // }
}
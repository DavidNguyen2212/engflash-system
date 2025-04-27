import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CardsModule } from './cards/cards.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get('DATABASE_USERNAME'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
        logging: true,
        logger: 'advanced-console',
        retryAttempts: 5,
        retryDelay: 3000,
        autoLoadEntities: true,
        keepConnectionAlive: true,
        verboseRetryLog: true,
        ssl: true,
        extra: {
          max: 20,
          connectionTimeoutMillis: 10000,
        },
      }),
      inject: [ConfigService]
    }),
    ConfigModule.forRoot({
      isGlobal: true
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', "captions"),
      serveRoot: '/captions'
    }),
    UsersModule,
    AuthModule,
    CardsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

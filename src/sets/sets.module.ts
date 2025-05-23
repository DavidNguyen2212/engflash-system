import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Set } from "./entities"
import { SetsController } from "./sets.controller";
import { SetsService } from "./sets.service";
import { CardsModule } from "src/cards/cards.module";
import { Card } from "src/cards/entities";
import { User } from "src/users/entities";

@Module({
    imports: [TypeOrmModule.forFeature([Set, Card, User]),
        forwardRef(() => CardsModule)
    ],
    controllers: [SetsController],
    providers: [SetsService],
    exports: [SetsService]
})
export class SetsModule {}
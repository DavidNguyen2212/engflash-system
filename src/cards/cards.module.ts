import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Card, Set, Topic } from "./entities";
import { CardsController } from "./cards.controller";
import { CardsService } from "./cards.service";

@Module({
    imports: [TypeOrmModule.forFeature([Card, Set, Topic])],
    controllers: [CardsController],
    providers: [CardsService],
    exports: [CardsService]
})
export class CardsModule {}
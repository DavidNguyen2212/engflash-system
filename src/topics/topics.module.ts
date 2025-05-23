import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Topic } from "./entities"
import { TopicsController } from "./topics.controller";
import { TopicsService } from "./topics.service";
import { CardsModule } from "../cards/cards.module";
import { Card } from "src/cards/entities";
import { User } from "src/users/entities";

@Module({
    imports: [TypeOrmModule.forFeature([Topic, Card, User]),
        forwardRef(() => CardsModule)
    ],
    controllers: [TopicsController],
    providers: [TopicsService],
    exports: [TopicsService]
})
export class TopicsModule {}
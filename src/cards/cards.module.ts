import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CardsController } from "./cards.controller";
import { CardsService } from "./cards.service";
import { TopicsModule } from "src/topics/topics.module";
import { SetsModule } from "src/sets/sets.module";
import { Card, Set, Topic } from "./entities";

@Module({
    // We need forwardRef because we are importing the CardsModule in the TopicsModule and the SetsModule
    // and we need to avoid circular dependency
    imports: [TypeOrmModule.forFeature([Card, Topic, Set]),
        forwardRef(() => TopicsModule),
        forwardRef(() => SetsModule)
    ],
    controllers: [CardsController],
    providers: [CardsService],
    exports: [CardsService]
})
export class CardsModule {}
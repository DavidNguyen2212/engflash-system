import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards";
import { StatisticsService } from "./statistics.service";
import { CurrentUser } from "../auth/decorators";


@ApiTags('statistics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('statistics')
export class StatisticsController {
    constructor(private readonly statisticsService: StatisticsService) {}

    // Private route to add word to a default topic


    // Learning
    @Get('streak')
    @ApiOperation({ summary: `Get current user's streak` })
    @ApiResponse({ status: 201, description: 'Successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getStreakLength(@CurrentUser() user) {
        return this.statisticsService.getStreakLengthByUser(user.id)
    }

    @Get('proficient-cards')
    @ApiOperation({ summary: 'Get statistics about total & proficient cards' })
    @ApiResponse({ status: 201, description: 'Successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getCardStats(
        @CurrentUser() user,
    ) {
        return this.statisticsService.getCardStatsByUser(user.id)
    }

    @Get('learning-status')
    @ApiOperation({ summary: 'Get statistics about 4 types of card: chưa học, đang học, đã học, đã ôn' })
    @ApiResponse({ status: 201, description: 'Successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getCardStatusStats(
        @CurrentUser() user,
    ) {
        return this.statisticsService.getCardStatusStatsByUser(user.id)
    }

    @Get('weekly-and-5days')
    @ApiOperation({ summary: 'Get statistics about 4 types of card: chưa học, đang học, đã học, đã ôn' })
    @ApiResponse({ status: 201, description: 'Successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getCardStatusLongTime(
        @CurrentUser() user,
    ) {
        return this.statisticsService.getCardStatusLongTimeByUser(user.id)
    }



   
    // Revision
    @Get(':topicId/revision-cards')
    @ApiOperation({ summary: 'Get all cards needs to revise from a single topic' })
    @ApiResponse({ status: 201, description: 'Successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiParam({ name: 'topicId', required: true, type: Number})
    async getCardRevisionTopic(
        @CurrentUser() user,
        @Param('topicId', ParseIntPipe) topicId: number
    ) {
        return this.statisticsService.reviseTopicCards(user.id, topicId)
    }

}

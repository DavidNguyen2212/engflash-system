import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards";
import { CurrentUser } from "../auth/decorators";
import { NotificationsService } from "./notifications.service";


@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    // Private route to add word to a default topic


    // Learning
    @Get('streak')
    @ApiOperation({ summary: `Get current user's streak` })
    @ApiResponse({ status: 201, description: 'Successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getStreakLength(@CurrentUser() user) {
        return this.notificationsService.getStreakLengthByUser(user.id)
    }

    @Get('proficient-cards')
    @ApiOperation({ summary: 'Get statistics about total & proficient cards' })
    @ApiResponse({ status: 201, description: 'Successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getCardStats(
        @CurrentUser() user,
    ) {
        return this.notificationsService.getCardStatsByUser(user.id)
    }

    @Get('learning-status')
    @ApiOperation({ summary: 'Get statistics about 4 types of card: chưa học, đang học, đã học, đã ôn' })
    @ApiResponse({ status: 201, description: 'Successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getCardStatusStats(
        @CurrentUser() user,
    ) {
        return this.notificationsService.getCardStatusStatsByUser(user.id)
    }

}

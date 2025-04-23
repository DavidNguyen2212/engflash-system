import { Body, Controller, Get, Param, ParseBoolPipe, ParseIntPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards";
import { CardsService } from "./cards.service";
import { CurrentUser } from "../auth/decorators";
import { ModifyExampleDTO } from "./dto/modifyExample.dto";
import { AddCardDTO, NewMeaningDTO } from "./dto/addCard.dto";


@ApiTags('cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cards')
export class CardsController {
    constructor(private readonly cardsService: CardsService) {}

    // Learning
    @Get('allMaterials')
    @ApiOperation({ summary: '' })
    @ApiResponse({ status: 201, description: 'User successfully created' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiQuery({ name: 'topic_only', required: false, type: Boolean})
    async getAllTopicsAndSets(
        @CurrentUser() user,
        @Query('topic_only', ParseBoolPipe) topic_only: boolean
    ) {
        return this.cardsService.getAllTopicsAndSets(user.id, topic_only)
    }

    @Get('cards-from-topic')
    @ApiOperation({ summary: '' })
    @ApiResponse({ status: 201, description: 'User successfully created' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiQuery({ name: 'topic_id', required: true, type: Number})
    async getAllCardsfromTopic(
        @CurrentUser() user,
        @Query('topic_id', ParseIntPipe) topic_id: number
    ) {
        return this.cardsService.getAllCardsfromTopic(user.id, topic_id)
    }

    @Get('cards-from-set')
    @ApiOperation({ summary: '' })
    @ApiResponse({ status: 201, description: 'User successfully created' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiQuery({ name: 'set_id', required: true, type: Number})
    async getAllCardsfromSet(
        @CurrentUser() user,
        @Query('set_id', ParseIntPipe) set_id: number
    ) {
        return this.cardsService.getAllCardsfromSet(user.id, set_id)
    }

    @Put('modify-example')
    @ApiOperation({ summary: '' })
    @ApiResponse({ status: 201, description: 'User successfully created' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async modifyCardExample(
        @CurrentUser() user,
        @Body() modifyExampleData: ModifyExampleDTO
    ) {
        return this.cardsService.modifyCardExample(user.id, modifyExampleData)
    }

    @Post('new-card')
    @ApiOperation({ summary: '' })
    @ApiResponse({ status: 201, description: 'User successfully created' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async addNewCard(
        @CurrentUser() user,
        @Body() newCardData: AddCardDTO
    ) {
        return this.cardsService.addCardtoTopic(user.id, newCardData)
    }


    // Revision
    @Get('cards-revision-topic')
    @ApiOperation({ summary: '' })
    @ApiResponse({ status: 201, description: 'User successfully created' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiQuery({ name: 'topic_id', required: true, type: Number})
    async getCardRevisionTopic(
        @CurrentUser() user,
        @Query('topic_id', ParseIntPipe) topic_id: number
    ) {
        return this.cardsService.reviseTopicCards(user.id, topic_id)
    }


    // Learn from video
    @Post('extract-meaning')
    @ApiOperation({ summary: '' })
    @ApiResponse({ status: 201, description: 'User successfully created' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async extractMeaning(
        @CurrentUser() user,
        @Body() newCardData: NewMeaningDTO
    ) {
        return this.cardsService.getIPAandMeaning(newCardData.front_text)
    }

    @Post('process-video')
    @ApiOperation({ summary: '' })
    @ApiResponse({ status: 201, description: 'User successfully created' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async processVideo(
        @CurrentUser() user,
        @Body() newCardData: NewMeaningDTO
    ) {
        return this.cardsService.getIPAandMeaning(newCardData.front_text)
    }

    @Post('create_from_script')
    @ApiOperation({ summary: '' })
    @ApiResponse({ status: 201, description: 'User successfully created' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async createFromScript(
        @CurrentUser() user,
        @Body() newCardData: NewMeaningDTO
    ) {
        return this.cardsService.getIPAandMeaning(newCardData.front_text)
    }

    @Post('loading_video')
    @ApiOperation({ summary: '' })
    @ApiResponse({ status: 201, description: 'User successfully created' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async (
        @CurrentUser() user,
        @Body() newCardData: NewMeaningDTO
    ) {
        return this.cardsService.getIPAandMeaning(newCardData.front_text)
    }


    // Revision
    @Get('cards-revision-set')
    @ApiOperation({ summary: '' })
    @ApiResponse({ status: 201, description: 'User successfully created' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiQuery({ name: 'set_id', required: true, type: Number})
    async getCardRevisionSet(
        @CurrentUser() user,
        @Query('set_id', ParseIntPipe) set_id: number
    ) {
        return this.cardsService.reviseSetCards(user.id, set_id)
    }


}
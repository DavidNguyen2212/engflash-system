import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Card, Topic, UserCardReview, UserCardReviewLog } from 'src/cards/entities';
import axios from 'axios';
import { User } from 'src/users/entities';
import { OpenAIService } from 'src/shared/services/openai.service';
import { DateTime } from 'luxon';
import { UserDailyActivity } from 'src/statistics/entities';

@Injectable()
export class NotificationsService {
    constructor(
        private dataSource: DataSource,
        @InjectRepository(Card)
        private cardRepository: Repository<Card>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(UserCardReview)
        private reviewRepository: Repository<UserCardReview>,
        @InjectRepository(Topic)
        private topicRepository: Repository<Topic>,
        @InjectRepository(UserDailyActivity)
        private dailyActivityRepository: Repository<UserDailyActivity>,
        @InjectRepository(UserCardReviewLog)
        private reviewLogRepository: Repository<UserCardReviewLog>,
        private openaiService: OpenAIService
    ) { 

    }

    async getStreakLengthByUser(userId: number) {
      const activities = await this.dailyActivityRepository.find({
        where: { user: { id: userId } },
        order: { date: 'DESC' },
      });
    
      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
    
      for (let i = 0; i < activities.length; i++) {
        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - i);
    
        const activityDate = new Date(activities[i].date);
        activityDate.setHours(0, 0, 0, 0);
    
        if (activityDate.getTime() === expectedDate.getTime()) {
          streak++;
        } else {
          break;
        }
      }
    
      return {streak};
    }

    async getCardStatsByUser(userId: number)  {
      const total_cards = await this.cardRepository.count({
        where: {
          user: { id: userId }
        }
      })

      const mastered_cards = await this.reviewRepository.count({
        where: {
          user: { id: userId },
          repetitions: MoreThanOrEqual(5),
          interval: MoreThanOrEqual(5)
        }
      })

      return {
        total_cards,
        mastered_cards
      }
    }

    // ORM VERSION
    // async getCardStatusStatsByUser2(userId: number) {
    //   const today = new Date();
    //   const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    //   const cards = await this.cardRepository
    //     .createQueryBuilder('card')
    //     .leftJoinAndSelect(
    //       'card.userReviews',
    //       'review',
    //       'review.user_id = :userId',
    //       { userId }
    //     )
    //     .where('card.user_id = :userId', { userId })
    //     .getMany();
    
    //   let stats = {
    //     learning: 0,
    //     learned: 0,
    //     mastered: 0,
    //     not_started: 0,
    //   };
    
    //   for (const card of cards) {
    //     const review = card.userReviews?.[0];
    
    //     if (!review) {
    //       stats.not_started += 1;
    //     } else if (review.repetitions === 0) {
    //       stats.learning += 1;
    //     } else if (review.repetitions >= 1 && review.interval < 21) {
    //       stats.learned += 1;
    //     } else if (
    //       review.interval >= 21 ||
    //       (review.last_review_date && review.last_review_date <= oneWeekAgo)
    //     ) {
    //       stats.mastered += 1;
    //     }
    //   }
    
    //   return stats;
    // }
  
    // rawSQL VERSION
    async getCardStatusStatsByUser(userId: number) {
      const result = await this.dataSource.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE r.id IS NULL
          ) AS not_started,
    
          COUNT(*) FILTER (
            WHERE r.id IS NOT NULL AND r.repetitions = 0
          ) AS learning,
    
          COUNT(*) FILTER (
            WHERE r.repetitions >= 1 AND r.interval < 21
          ) AS learned,
    
          COUNT(*) FILTER (
            WHERE r.interval >= 21 OR r.last_review_date <= NOW() - INTERVAL '7 days'
          ) AS mastered
    
        FROM cards c
        LEFT JOIN user_card_reviews r ON c.card_id = r.card_id AND r.user_id = $1
        WHERE c.user_id = $1;
      `, [userId]);
    
      return result[0];
    }

    async getCardStatusLongTimeByUser(user_id: string) {
      // Lấy thời gian hiện tại theo timezone Asia/Ho_Chi_Minh
      const vietnamNow = DateTime.now().setZone('Asia/Ho_Chi_Minh');
    
      // Set về đầu ngày hôm nay (00:00:00)
      const today = vietnamNow.startOf('day');
    
      // === XỬ LÝ 5 NGÀY GẦN NHẤT ===
      const fiveDaysAgo = today.minus({ days: 4 });
    
      const fiveDayStats = await this.reviewLogRepository
        .createQueryBuilder('log')
        .select("TO_CHAR((log.reviewed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(*)', 'count')
        .where('log.user_id = :user_id', { user_id })
        .andWhere(`log.reviewed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh' >= :startDate`, {
          startDate: fiveDaysAgo.toISODate()
        })
        .andWhere(`log.reviewed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh' < :endDate`, {
          endDate: today.plus({ days: 1 }).toISODate()
        })
        .groupBy("TO_CHAR((log.reviewed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD')")
        .orderBy('date', 'ASC')
        .getRawMany();
    
      const result5Days: { date: string | null; count: number }[] = [];
      for (let i = 0; i < 5; i++) {
        const date = fiveDaysAgo.plus({ days: i });
        const dateStr = date.toISODate();
        const stat = fiveDayStats.find(d => d.date === dateStr);
        result5Days.push({ date: dateStr, count: stat ? Number(stat.count) : 0 });
      }
    
      // === XỬ LÝ TUẦN NÀY ===
      const weekday = today.weekday; // 1 = Monday, 7 = Sunday
      const monday = today.minus({ days: weekday - 1 });
    
      const thisWeekStats = await this.reviewLogRepository
        .createQueryBuilder('log')
        .select("TO_CHAR((log.reviewed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(*)', 'count')
        .where('log.user_id = :user_id', { user_id })
        .andWhere(`log.reviewed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh' >= :weekStart`, {
          weekStart: monday.toISODate()
        })
        .andWhere(`log.reviewed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh' < :weekEnd`, {
          weekEnd: today.plus({ days: 1 }).toISODate()
        })
        .groupBy("TO_CHAR((log.reviewed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD')")
        .orderBy('date', 'ASC')
        .getRawMany();
    
      const result7Days: { date: string | null; count: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const date = monday.plus({ days: i });
        const dateStr = date.toISODate();
        let stat: any;
    
        if (date > today) {
          stat = null;
        } else {
          stat = thisWeekStats.find(d => d.date === dateStr);
        }
    
        result7Days.push({ date: dateStr, count: stat ? Number(stat.count) : 0 });
      }
    
      return {
        thisWeekStats: result7Days,
        last5DaysStats: result5Days,
      };
    }

    async createTopicFromTranscript(user_id: string, url: string, level: string) {
      let vttContent: string;
      try {
        const response = await axios.get<string>(url, { responseType: 'text' });
        console.log("response", response.data);
        vttContent = response.data;
      } catch (err) {
        console.log(`Failed to fetch VTT from ${url}`, err);
        throw new BadRequestException('Cannot fetch transcript file');
      }

      try {
        const transcriptText = vttContent.split('\n').filter((line) => line && !line.includes("-->") && line != "WEBVTT").join(' ') 
        console.log(transcriptText);
        const results = await this.openaiService.makeWordList(Number(user_id), transcriptText, level)
        // Insert into topic, get the new topic id
        // then batch insert to card
        return await this.dataSource.transaction(async manager => {
          const topic = manager.create(Topic, {
            topic_name: results.topic,
            topic_description: results.topic_description,
            is_default: false
          })
          const savedTopic = await manager.save(topic)

          const cardsToSave = results.words.map(w => 
            manager.create(Card, {
              front_text: w.front_text,
              back_text: w.back_text,
              ipa_pronunciation: w.ipa_pronunciation,
              example: w.example,
              example_meaning: w.example_meaning,
              topic: savedTopic,
              user: {id: Number(user_id)}
            })
          )
          const savedCards = await manager.save(cardsToSave);
          return {
            topic: savedTopic,
            cards: savedCards
          }
        })
      } catch (error) {
        let message = 'Unknown Error'
        if (error instanceof Error) message = error.message
        // we'll proceed, but let's report it
        console.log(message)
      }
    }

    async reviseTopicCards(userId: string, topicId: number) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Để so sánh chính xác đến ngày
    
      const cardsToReview = await this.reviewRepository.find({
        where: {
          user: { id: Number(userId) },
          card: {
            topic: { topic_id: topicId },
          },
          next_review_date: LessThanOrEqual(today),
        },
        relations: ['card', 'choices'],
      });

      if (!cardsToReview || cardsToReview.length === 0) {
        throw new NotFoundException(
          `No cards to review in topic ${topicId} for user ${userId}`,
        );
      }

      const deck = cardsToReview.map((review) => ({
        card: review.card,
        choices: review.choices.map((c) => Object({key: c.text, value: c.isCorrect})), // from DB, no need OpenAI anymore
      }));

      return deck;
    }


}

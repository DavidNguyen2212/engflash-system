import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Set } from './entities';
import { Card } from 'src/cards/entities';
import { User } from 'src/users/entities';

@Injectable()
export class SetsService {
    constructor(
        private dataSource: DataSource,
        @InjectRepository(Card)
        private cardRepository: Repository<Card>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Set)
        private setRepository: Repository<Set>,
    ) { }

    async getAllSetsByUser(user_id: string) {
      const user = await this.userRepository.findOne({
        where: {
          id: Number(user_id)
        },
      });

      if (!user) {
        throw new NotFoundException(`User with ${user_id} not found!`);
      }

      if (!user.defaultSetsLoaded) {
        // Get default topics
        const defaultSets = await this.setRepository.find({});
    
        // Cloning by transaction 
        await this.dataSource.transaction(async manager => {
          user.defaultSetsLoaded = true;
          await manager.save(user);
    
          for (const defSet of defaultSets) {
            const defaultCards = await this.cardRepository.find({
              where: {
                user: IsNull(),
                set: { set_id: defSet.set_id },
              },
            });

            if (defaultCards.length > 0) {
              const clonedCards = defaultCards.map(card => {
                const { card_id, ...rest } = card;
                return manager.create(Card, {
                  ...rest,
                  set: defSet,          
                  user: user,                  
                });
              });
              await manager.save(clonedCards);
            }
          }
        });
      }

      const sets = await this.setRepository
            .createQueryBuilder('set')
            .leftJoin('set.cards', 'card')
            .where('card.user_id = :user_id', { user_id })
            .orderBy('set.set_id', 'ASC')
            .getMany()
        
      return { sets }
    }

    async getAllCardsfromSet(user_id: string, set_id: number) {
      const cards = await this.cardRepository
          .createQueryBuilder('card')
          .where('card.set_id = :set_id AND card.user_id = :user_id', {
              set_id,
              user_id,
          })
          .getMany()
      
      return { cards }
  }

    async createMultipleChoice(words: string, meaning: string) {
        return ["Dummy 1", "Dummy 2", meaning]
    }
    async reviseTopicCards(user_id: string, topic_id: number) {
        const cards = await this.cardRepository.find({
            where: {
              topic: {topic_id},
              user: {
                id: parseInt(user_id),
              },
            },
            // relations: ['user'],
        });

        if (!cards) {
            throw new NotFoundException(`Card belonging topic ${topic_id} not found or does not belong to user ${user_id}`);
        }

        const deck = await Promise.all(
            cards.map(async (card) => ({
              card,
              choices: await this.createMultipleChoice(card.front_text, card.back_text),
            })),
          );

        return deck
    }

    async reviseSetCards(user_id: string, set_id: number) {
        const cards = await this.cardRepository.find({
            where: {
              set: {set_id},
              user: {
                id: parseInt(user_id),
              },
            },
            // relations: ['user'],
        });

        if (!cards) {
            throw new NotFoundException(`Card belonging topic ${set_id} not found or does not belong to user ${user_id}`);
        }

        const deck = await Promise.all(
            cards.map(async (card) => ({
              card,
              choices: await this.createMultipleChoice(card.front_text, card.back_text),
            })),
          );

        return deck
    }
    
    async getSingleMeaning(word: string) {
      // OpenAI implementation
      // Get the backtext (vietnamese meaning) and example
      return {
        front_text: word,
        back_text: "Con lợn",
        example: "He is a pig in the kitchen."
      }
    }

}

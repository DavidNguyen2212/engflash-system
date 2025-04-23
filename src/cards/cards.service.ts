import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Card, Set, Topic } from './entities';
import { ModifyExampleDTO } from './dto/modifyExample.dto';

@Injectable()
export class CardsService {
    constructor(
        @InjectRepository(Card)
        private cardRepository: Repository<Card>,
        @InjectRepository(Topic)
        private topicRepository: Repository<Topic>,
        @InjectRepository(Set)
        private setRepository: Repository<Set>,
    ) { }

    async getAllTopicsAndSets(user_id: string, topic_only: boolean = false) {
        const topics = await this.topicRepository // from topics
            .createQueryBuilder('topic')  // flexible query -> as topic
            .leftJoin('topic.cards', 'card') // left join 
            .where('card.user_id = :user_id', {user_id}) // where card.user_id = user_id
            .orderBy('topic.topic_id', 'ASC') // order by asc
            .getMany() // select *

        if (topic_only) {
            return topics
        }

        const sets = await this.setRepository // from sets
            .createQueryBuilder('set') // as set
            .leftJoin('set.cards', 'card') // left join 
            .where('card.user_id = :user_id', {user_id}) // where card.user_id = user_id
            .orderBy('set.set_id', 'ASC') // order by asc
            .getMany() // select *   

        return {
            topics,
            sets
        }
    }

    async getAllCardsfromTopic(user_id: string, topic_id: number) {
        const cards = await this.cardRepository
            .createQueryBuilder('card')
            .where('card.topic_id = :topic_id AND card.user_id = :user_id', {
                topic_id,
                user_id,
            })
            .getMany()
        
        return { cards }
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

    // async getAIGrammar(text: string) {
    // }

    async getAIGrammar(text: string) {

    }

    async getIPAandMeaning(text: string, example: string | null = null) {

    }

    async modifyCardExample(user_id: string, payload: ModifyExampleDTO) {
        const { card_id, front_text = "", back_text = "", example = "" } = payload;
        const updateData: any = {}

        // Chỉ thêm trường nếu nó khác chuỗi rỗng sau khi trim (loại bỏ khoảng trắng đầu/cuối)
        if (front_text && front_text.trim() !== "") {
            updateData.front_text = front_text;
        }
        if (back_text && back_text.trim() !== "") {
            updateData.back_text = back_text;
        }
        if (example && example.trim() !== "") {
            updateData.example = example;
        }


        // can ai generated these
        let dummy_ipa = "/gia/" 
        let dummy_vie_meaning = "Chào bạn nhé"

        updateData.example_meaning = dummy_vie_meaning;
        updateData.ipa_pronunciation = dummy_ipa;

        const cards = await this.cardRepository
            .createQueryBuilder()
            .update()
            .set(updateData)
            .where('card_id = :card_id AND user_id = :user_id', {card_id, user_id})
            .execute()
        
        return { cards }
    }

    async deleteCard(user_id: string, card_id: number) {
        const card = await this.cardRepository.findOne({
            where: {
              card_id,
              user: {
                id: parseInt(user_id),
              },
            },
            relations: ['user'],
        });
        
    
        if (!card) {
            throw new NotFoundException(`Card with ID ${card_id} not found or does not belong to user ${user_id}`);
        }
    
        await this.cardRepository.delete({ card_id });
        return { message: `Card with ID ${card_id} deleted successfully` };
    }

    async addCardtoTopic(user_id: string, payload: any) {
        // Destructure và gán giá trị mặc định
        const { front_text = "", back_text = "", example = "", topic_id = null } = payload;
        
        const updateData: any = {};
      
        // Chỉ thêm trường nếu nó khác chuỗi rỗng sau khi trim
        if (front_text && front_text.trim() !== "") {
          updateData.front_text = front_text;
        }
        if (back_text && back_text.trim() !== "") {
          updateData.back_text = back_text;
        }
        if (example && example.trim() !== "") {
          updateData.example = example;
        } else {
          updateData.example = "Hello how are you today";
        }
        
        // Nếu có topic_id, gán cho quan hệ topic dưới dạng object chứa khóa chính
        if (topic_id) {
          updateData.topic = { topic_id: topic_id };
        }
      
        // Dummy values
        const dummy_ipa = "/gia/"; 
        const dummy_vie_meaning = "Chào bạn nhé";
        
        updateData.example_meaning = dummy_vie_meaning;
        updateData.ipa_pronunciation = dummy_ipa;
        
        // Gán cho quan hệ user (convert user_id từ string sang number nếu cần)
        updateData.user = { id: Number(user_id) };
      
        // Insert bản ghi mới
        const cards = await this.cardRepository.insert(updateData);
        
        return { cards };
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
    

}

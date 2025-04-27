import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Card, Set, Topic } from './entities';
import { ModifyExampleDTO } from './dto/modifyExample.dto';
import { YoutubeTranscript } from 'youtube-transcript';
import { join } from 'path';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { decode, decodeEntity } from 'html-entities';

@Injectable()
export class CardsService {
    constructor(
        private dataSource: DataSource,
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
        } else {
          // Get all the topic belong to user_id
          // Create new topic by openai
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
    
    async getSingleMeaning(word: string) {
      // OpenAI implementation
      // Get the backtext (vietnamese meaning) and example
      return {
        front_text: word,
        back_text: "Con lợn",
        example: "He is a pig in the kitchen."
      }
    }

    async processVideo(url: string) {
      // 1. Extract video ID
      const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)
      if (!match) 
        throw new BadRequestException('Invalid YouTube URL');
      const videoId = match[1];

      // 2. Fetch the transcript array [{ text, start, duration }]
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' })

      // 3. Build WebVTT content
      const vttLines = ["WEBVTT\n"]
      transcript.forEach(({ text, duration, offset }) => {
        const startMs = offset * 1000
        const endMs = (offset + duration) * 1000
        const decoded = decode(decode(text));

        const fmt = (ms: number) => new Date(ms).toISOString().substring(11, 23).replace('.', ',')
        vttLines.push(
          `${fmt(startMs)} --> ${fmt(endMs)}`,
          decoded,
          ''
        )
      })

      const vttContent = vttLines.join('\n')

      // 4. Write file .vtt
      const captionsDir = join(process.cwd(), 'captions');
      await mkdir(captionsDir, { recursive: true });
      const outPath = join(process.cwd(), 'captions', `${videoId}.vtt`);
      await writeFile(outPath, vttContent, 'utf8')

      return {
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        captionUrl: `/captions/${videoId}.vtt`
      }
    }

    private async makeWordsByLLM(user_id: number, script: string, level: string) {
      // dummy, i will replace with openai
      return {
        topic: `MyTopic (${level})`,
        topic_description: `hello world`,
        words: [
          {
            front_text: 'shut up',
            back_text: 'im lặng',
            ipa_pronunciation: '/ʃʌt ʌp/',
            example: 'Shut up and listen!',
            example_meaning: 'Im lặng và nghe đi!',
          },
          {
            front_text: 'silent',
            back_text: 'im lặng',
            ipa_pronunciation: '/ˈsaɪlənt/',
            example: 'Keep silent during the movie.',
            example_meaning: 'Giữ im lặng trong khi xem phim.',
          },
        ],
      }
    }

    async makeTopicFromTranscript(user_id: string, url: string, level: string) {
      // 1. Extract video ID
      const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)
      if (!match) 
        throw new BadRequestException('Invalid YouTube URL');
      const videoId = match[1];

      // 2. Verify if id exists
      const captionsDir = join(process.cwd(), 'captions');
      const vttPath     = join(captionsDir, `${videoId}.vtt`);

      try {
        await access(vttPath)
        const vtt = await readFile(vttPath, 'utf-8')
        const transcriptText = vtt.split('\n').filter((line) => line && !line.includes("-->") && line != "WEBVTT").join(' ') 
        const results = await this.makeWordsByLLM(Number(user_id), transcriptText, level)
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

}

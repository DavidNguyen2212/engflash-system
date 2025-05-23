import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { Card, Topic } from 'src/cards/entities';
import { YoutubeTranscript } from 'youtube-transcript';
import { decode } from 'html-entities';
import { join } from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import axios from 'axios';
import { User } from 'src/users/entities';

@Injectable()
export class TopicsService {
    constructor(
        private dataSource: DataSource,
        @InjectRepository(Card)
        private cardRepository: Repository<Card>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Topic)
        private topicRepository: Repository<Topic>,
        private configService: ConfigService
    ) { 

      cloudinary.config({
        cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
        api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
        api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
      });

    }

    async getAllTopicsByUser(user_id: string) {
      const user = await this.userRepository.findOne({
        where: {
          id: Number(user_id)
        },
      });

      if (!user) {
        throw new NotFoundException(`User with ${user_id} not found!`);
      }

      if (!user.defaultTopicsLoaded) {
        // Get default topics
        const defaultTopics = await this.topicRepository.find({
          where: { is_default: true },
          relations: ['cards'],
        });
    
        // Cloning by transaction 
        await this.dataSource.transaction(async manager => {
          user.defaultTopicsLoaded = true;
          await manager.save(user);
    
          for (const defTopic of defaultTopics) {
            const defaultCards = await this.cardRepository.find({
              where: {
                user: IsNull(),
                topic: { topic_id: defTopic.topic_id },
              },
            });

            if (defaultCards.length > 0) {
              const clonedCards = defaultCards.map(card => {
                const { card_id, ...rest } = card;
                return manager.create(Card, {
                  ...rest,
                  topic: defTopic,           // gán topic mới
                  user: user,                  // gán user hiện tại
                });
              });
              await manager.save(clonedCards);
            }
          }
        });
      }

      const topics = await this.topicRepository
          .createQueryBuilder('topic')
          .leftJoin('topic.cards', 'card')
          .where('card.user_id = :user_id', { user_id })
          .orderBy('topic.topic_id', 'ASC')
          .getMany()
      
      return { topics }
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

  
    async createTranscriptFromVideo(url: string) {
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
      // const captionsDir = join(process.cwd(), 'captions');
      // await mkdir(captionsDir, { recursive: true });
      // const outPath = join(process.cwd(), 'captions', `${videoId}.vtt`);
      // await writeFile(outPath, vttContent, 'utf8')
      const uploadResult: any = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            public_id: `captions/${videoId}`,
            overwrite: true,
            format: 'vtt',
          },
          (error, result) => {
            if (error) return reject(error)
            resolve(result)
          }
        )
        uploadStream.end(Buffer.from(vttContent, 'utf8'))
      })

      return {
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        captionUrl: uploadResult.secure_url
      }
    }

    private async makeWordsByLLM(user_id: number, script: string, level: string) {
      // dummy, i will replace with openai
      const openai = new OpenAI({
        apiKey: this.configService.get<string>('OPENAI_API_KEY'), // đảm bảo có trong .env
      });

      const prompt = `
  Bạn là một trợ lý học tiếng Anh. Với đoạn script sau: 
  <Script>
  ${script}
  </Script>
  Tôi cần bạn trích xuất ra những từ có cấp độ ${level}. Hãy trả về kết quả ở định dạng JSON (không giải thích gì thêm):
  {
    topic: "..." // tên topic mà bạn đề xuất,
    topic_description: "..." // mô tả cho topic này,
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
    ], // Là một list của các object từ, mỗi object gồm các trường cho một flashcard, gồm frontext (từ), back_text (nghĩa tiếng Việt của từ), ipa_pronunciation (phát âm ipa), example (ví dụ tiếng Anh cho từ), example_meaning (nghĩa tiếng Việt của ví dụ)
  }
    Tránh trả về triple backticks.
      `;
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4,
      });
  
      try {
        const content = response.choices[0].message.content;
        console.log(content)
        const data = JSON.parse(content ?? "");
        console.log(data)
        return data
      } catch (err) {
        console.error('Error generating json content:', err);
      }

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
        // await access(vttPath)
        // const vtt = await readFile(vttPath, 'utf-8')
        const transcriptText = vttContent.split('\n').filter((line) => line && !line.includes("-->") && line != "WEBVTT").join(' ') 
        console.log(transcriptText);
        const results = await this.makeWordsByLLM(Number(user_id), transcriptText, level)
        // return true
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

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, LessThanOrEqual } from 'typeorm';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { Card, Topic, UserCardReview } from 'src/cards/entities';
import { YoutubeTranscript } from 'youtube-transcript';
import { v2 as cloudinary } from 'cloudinary';
import {google, youtube_v3} from 'googleapis'
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { User } from 'src/users/entities';
import { OpenAIService } from 'src/shared/services/openai.service';
import { decode } from 'html-entities';


interface CaptionTrack {
  id: string;
  name: { simpleText: string };
  languageCode: string;
  baseUrl: string;
}

interface TranscriptItem {
  text: string;
  start: number;
  duration: number;
}

@Injectable()
export class TopicsService {

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
        private configService: ConfigService,
        private openaiService: OpenAIService,
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
            // Tạo bản sao của topic
            const clonedTopic = manager.create(Topic, {
              topic_name: defTopic.topic_name,
              topic_description: defTopic.topic_description,
              is_default: true,
              user: user
            });
            await manager.save(clonedTopic);
              
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
                  topic: clonedTopic,           // gán topic mới
                  user: user,                  // gán user hiện tại
                });
              });
              await manager.save(clonedCards);
            }
          }
        });
      }
      // const topics = await this.topicRepository
      //     .createQueryBuilder('topic')
      //     .leftJoin('topic.cards', 'card')
      //     .where('card.user_id = :user_id', { user_id })
      //     .orderBy('topic.topic_id', 'ASC')
      //     .getMany()
      const topics = await this.topicRepository.find({
        where: { user: { id: Number(user_id) } },
        order: { topic_id: 'ASC' },
        // relations: ['cards'], // nếu cần preload cards
      });
      
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

    async createTranscriptFromVideo2(url: string) {
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

      // 4. Upload to cloudinary
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


    async createTranscriptFromVideo(url: string) {
      // 1. Extract video ID
      const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
      if (!match) {
        throw new BadRequestException('Invalid YouTube URL');
      }
      const videoId = match[1];
  
      try {
        // 2. Get caption tracks using YouTube API v3
        const captionTracks = await this.getCaptionTracks(videoId);
        
        if (captionTracks.length === 0) {
          throw new BadRequestException('No captions available for this video');
        }
  
        // 3. Find English caption track (prefer auto-generated if manual not available)
        const englishTrack = this.findBestEnglishTrack(captionTracks);
        
        if (!englishTrack) {
          throw new BadRequestException('No English captions available');
        }
  
        // 4. Fetch transcript content
        const transcript = await this.fetchTranscriptContent(englishTrack.baseUrl);
  
        // 5. Build WebVTT content
        const vttContent = this.buildWebVTT(transcript);
  
        // 6. Upload to cloudinary
        const uploadResult: any = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              resource_type: 'raw',
              public_id: `captions/${videoId}`,
              overwrite: true,
              format: 'vtt',
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );
          uploadStream.end(Buffer.from(vttContent, 'utf8'));
        });
  
        return {
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          captionUrl: uploadResult.secure_url
        };
  
      } catch (error) {
        console.error('Error creating transcript:', error);
        throw new BadRequestException(`Failed to create transcript: ${error.message}`);
      }
    }
  
    private async getCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
      // Method 1: Try YouTube API v3 first
      // try {
      //   const response = await fetch(
      //     `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${this.configService.get<string>("YOUTUBE_API_V3")}`
      //   );
        
      //   if (!response.ok) {
      //     throw new Error(`YouTube API error: ${response.status}`);
      //   }
  
      //   const data = await response.json();
        
      //   if (data.items && data.items.length > 0) {
      //     return data.items.map(item => ({
      //       id: item.id,
      //       name: { simpleText: item.snippet.name },
      //       languageCode: item.snippet.language,
      //       baseUrl: `https://www.googleapis.com/youtube/v3/captions/${item.id}?tfmt=ttml&key=${this.configService.get<string>("YOUTUBE_API_V3")}`
      //     }));
      //   }
      // } catch (error) {
      //   console.warn('YouTube API v3 failed, trying alternative method:', error.message);
      // }
  
      // Method 2: Fallback to parsing video page (less reliable but works without API quota)
      return this.getCaptionTracksFromVideoPage(videoId);
    }
  
    private async getCaptionTracksFromVideoPage(videoId: string): Promise<CaptionTrack[]> {
      try {
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
  
        const html = await response.text();
        
        // Extract caption tracks from the page
        const captionRegex = /"captionTracks":\[(.*?)\]/;
        const match = html.match(captionRegex);
        
        if (!match) {
          return [];
        }
  
        const captionTracksStr = `[${match[1]}]`;
        const captionTracks = JSON.parse(captionTracksStr);
        
        return captionTracks.map(track => ({
          id: track.languageCode,
          name: { simpleText: track.name?.simpleText || track.languageCode },
          languageCode: track.languageCode,
          baseUrl: track.baseUrl
        }));
  
      } catch (error) {
        console.error('Failed to extract captions from video page:', error);
        return [];
      }
    }
  
    private findBestEnglishTrack(tracks: CaptionTrack[]): CaptionTrack | null {
      // Priority: manual English > auto-generated English > any English variant
      const englishTracks = tracks.filter(track => 
        track.languageCode.startsWith('en') || 
        track.languageCode === 'en-US' ||
        track.languageCode === 'en-GB'
      );  

      if (englishTracks.length === 0) {
        return null;
      }
  
      // Prefer manual captions over auto-generated
      const manualTrack = englishTracks.find(track => 
        !track.name.simpleText.toLowerCase().includes('auto')
      );
      
      return manualTrack || englishTracks[0];
    }
  
    private async fetchTranscriptContent(baseUrl: string): Promise<TranscriptItem[]> {
      try {
        const response = await fetch(baseUrl);
        const xmlContent = await response.text();
        
        return this.parseTranscriptXML(xmlContent);
      } catch (error) {
        throw new Error(`Failed to fetch transcript content: ${error.message}`);
      }
    }
  
    private parseTranscriptXML(xmlContent: string): TranscriptItem[] {
      const transcript: TranscriptItem[] = [];
      
      // Parse TTML or simple XML format
      const textRegex = /<text[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>(.*?)<\/text>/g;
      let match;
  
      while ((match = textRegex.exec(xmlContent)) !== null) {
        const start = this.parseTimeToSeconds(match[1]);
        const duration = this.parseTimeToSeconds(match[2]);
        const text = decode(match[3].replace(/<[^>]*>/g, ''));
  
        transcript.push({
          text: text.trim(),
          start,
          duration
        });
      }
  
      // If TTML parsing fails, try simpler format
      if (transcript.length === 0) {
        const simpleRegex = /<p[^>]*t="([^"]*)"[^>]*d="([^"]*)"[^>]*>(.*?)<\/p>/g;
        
        while ((match = simpleRegex.exec(xmlContent)) !== null) {
          const start = parseFloat(match[1]) / 1000; // Convert ms to seconds
          const duration = parseFloat(match[2]) / 1000;
          const text = decode(match[3].replace(/<[^>]*>/g, ''));
  
          transcript.push({
            text: text.trim(),
            start,
            duration
          });
        }
      }
  
      return transcript;
    }
  
    private parseTimeToSeconds(timeStr: string): number {
      // Handle different time formats: "PT1.234S", "1.234s", or plain seconds
      if (timeStr.startsWith('PT') && timeStr.endsWith('S')) {
        return parseFloat(timeStr.slice(2, -1));
      }
      
      if (timeStr.endsWith('s')) {
        return parseFloat(timeStr.slice(0, -1));
      }
      
      return parseFloat(timeStr);
    }
  
    private buildWebVTT(transcript: TranscriptItem[]): string {
      const vttLines = ["WEBVTT\n"];
      
      transcript.forEach(({ text, start, duration }) => {
        const startMs = start * 1000;
        const endMs = (start + duration) * 1000;
        const decoded = decode(decode(text));
        
        const fmt = (ms: number) => 
          new Date(ms).toISOString().substring(11, 23).replace('.', ',');
        
        vttLines.push(
          `${fmt(startMs)} --> ${fmt(endMs)}`,
          decoded,
          ''
        );
      });
      
      return vttLines.join('\n');
    }
  
}

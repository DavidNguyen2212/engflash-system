import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Card, Set, Topic } from './entities';
import { AIExampleDTO, ModifyExampleDTO, NewMeaningDTO } from './dto';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

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
        private configService: ConfigService
    ) { }

    async generateAIGrammar(user_id: string, card_id: number) {
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

      const openai = new OpenAI({
        apiKey: this.configService.get<string>('OPENAI_API_KEY'), // đảm bảo có trong .env
      });

      const prompt = `
  Bạn là một trợ lý học tiếng Anh. Với từ/cụm từ sau: "${card.front_text}", nghĩa tiếng Việt của nó: "${card.back_text}", và một ví dụ cơ bản: "${card.example}", hãy trả về kết quả ở định dạng markdown. Yêu cầu như sau:

  - Mở đầu với tiêu đề: "Understanding ${card.front_text}." Sau đó giới thiệu về nó, sơ lược về các tình huống giao tiếp.
  - Tiếp theo là mục: "Meaning". Sau đó giải nghĩa từ này.
  - Tiếp theo là mục: "How to use it". Bạn đưa ra các trường hợp sử dụng.
  - Tiếp theo là mục: "Example of usage": Bạn đưa ra các ví dụ tương ứng với các usecase ở mục How to use it.
  - Cuối cùng là mục: "Synonyms". Sau đó đưa ra các từ đồng nghĩa.
      `;
  
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        });
  
        const markdownOutput = completion.choices[0]?.message?.content || '';
        card.grammar_markdown = markdownOutput;
        await this.cardRepository.save(card);
        return {
          card_id,
          grammar_markdown: markdownOutput,
        };
      } catch (error) {
        console.error('Error from OpenAI:', error);
        throw new Error('Failed to generate grammar explanation');
      }
  
    }

    async getMeaningfromAI(providedData: AIExampleDTO) {
      const openai = new OpenAI({
        apiKey: this.configService.get<string>('OPENAI_API_KEY'), // đảm bảo có trong .env
      });

      const prompt = `
  Bạn là một trợ lý học tiếng Anh. Với từ/cụm từ sau: "${providedData.front_text}", nghĩa tiếng Việt của nó: "${providedData.back_text}", hãy trả về kết quả ở định dạng JSON:
  {
    "example": "..." // Bạn cần đưa ra ví dụ tiếng anh với từ và nghĩa đã cho của nó. 
    "vietnamese_meaning": "..." // nghĩa tiếng Việt ngắn gọn, tự nhiên cho ví dụ tiếng anh bạn đã cung cấp ở trên
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
  
        const data = JSON.parse(content ?? "");
        console.log(data)
        return {
          vietnamese_meaning: data.vietnamese_meaning,
          example: data.example
        };
      } catch (err) {
        console.error('Error generating json content:', err);
        return {
          vietnamese_meaning: null,
          example: null
        };
      }
    }

    async modifyCardExample(user_id: string, payload: ModifyExampleDTO) {
        const { card_id, front_text, back_text = "", example = "", example_meaning = "" } = payload;
        const updateData: any = {}

        if (front_text && front_text.trim() !== "") {
            updateData.front_text = front_text;
        }
        if (back_text && back_text.trim() !== "") {
            updateData.back_text = back_text;
        }
        if (example && example.trim() !== "") {
            updateData.example = example;
        }
        if (example_meaning && example_meaning.trim() !== "") {
          updateData.example_meaning = example_meaning;
        }

        const cards = await this.cardRepository
            .createQueryBuilder()
            .update()
            .set(updateData)
            .where('card_id = :card_id AND user_id = :user_id', {card_id, user_id})
            .execute()
        
        return { cards }
    }

    async getIPAandMeaning(word: string, example: string | null = null) {
      const openai = new OpenAI({
        apiKey: this.configService.get<string>('OPENAI_API_KEY'), // đảm bảo có trong .env
      });
      const prompt = `
  Bạn là một trợ lý học tiếng Anh. Với từ/cụm từ sau: "${word}" và câu chứa từ này "${example || 'nil'}", hãy trả về kết quả ở định dạng JSON:
  {
    "ipa": "...", // phiên âm quốc tế IPA
    "example": "..." // Nếu câu chứa từ đó là 'nil', bạn cần đưa ra ví dụ tiếng anh với từ đã cho. Ngược lại, chỉ cần trả về câu đó với chữ cái đầu viết hoa.
    "vietnamese_meaning": "..." // nghĩa tiếng Việt ngắn gọn, tự nhiên cho câu chứa từ đó. Nếu câu là 'nil', bạn cần đưa ra nghĩa của ví dụ tiếng anh bạn đã cung cấp ở trên
    "topic_name": "..." // tên của topic mà bạn nghĩ từ vựng này nên thuộc về, ví dụ: "basketball" thì thuộc topic "sports"
    "topic_description": "..." // miêu tả ngắn về topic
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
  
        const data = JSON.parse(content ?? "");
        console.log(data)
        return {
          ipa: data.ipa,
          vietnamese_meaning: data.vietnamese_meaning,
          example: data.example,
          topic_name: data.topic_name,
          topic_description: data.topic_description
        };
      } catch (err) {
        console.error('Error generating json content:', err);
        return {
          ipa: null,
          vietnamese_meaning: null,
          example: null,
          topic_name: null,
          topic_description: null
        };
      }
    }

    async addCardtoTopic(user_id: string, payload: any) {
        // Destructure và gán giá trị mặc định
        const { front_text = "", back_text = "", example = "", topic_id = null } = payload;
        
        const updateData: any = {};
      
        if (front_text && front_text.trim() !== "") {
          updateData.front_text = front_text;
        }
        if (back_text && back_text.trim() !== "") {
          updateData.back_text = back_text;
        }
        if (example && example.trim() !== "") {
          updateData.example = example;
        }
       
        const aiResult = await this.getIPAandMeaning(
          updateData.front_text || front_text, 
          updateData.example || example
        );
      
        updateData.example_meaning = aiResult.vietnamese_meaning;
        updateData.ipa_pronunciation = `/${aiResult.ipa}/`;
        if (!updateData.example) 
          updateData.example = aiResult.example
        
        // Nếu có topic_id, gán cho quan hệ topic dưới dạng object chứa khóa chính
        if (topic_id) {
          updateData.topic = { topic_id: topic_id };
        } else {
          // Get all the topic belong to user_id
          // Create new topic: aiResult.topic
          const preNewTopic = this.topicRepository.create({
            topic_name: aiResult.topic_name,
            topic_description: aiResult.topic_description,
            is_default: false,
          });

          const newTopic = await this.topicRepository.save(preNewTopic);
          updateData.topic = { topic_id: newTopic.topic_id };
        }
        
        // Gán cho quan hệ user (convert user_id từ string sang number nếu cần)
        updateData.user = { id: Number(user_id) };
      
        // Insert bản ghi mới
        const cards = await this.cardRepository.insert(updateData);
        
        return { cards };
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

  //   async createMultipleChoice(words: string, meaning: string) {
  //       return ["Dummy 1", "Dummy 2", meaning]
  //   }

    async getSingleMeaning(wordData: NewMeaningDTO) {
      const openai = new OpenAI({
        apiKey: this.configService.get<string>('OPENAI_API_KEY'), // đảm bảo có trong .env
      });
      const prompt = `
  Bạn là một trợ lý học tiếng Anh. Với từ/cụm từ sau: "${wordData.front_text}" và ngữ cảnh của nó: "${wordData.cover_sentence}", hãy trả về kết quả ở định dạng JSON:
  {
    "meaning": "..." // nghĩa tiếng Việt của từ đó
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
  
        const data = JSON.parse(content ?? "");
        console.log(data)
        return {
          meaning: data.meaning,
        };
      } catch (err) {
        console.error('Error generating json content:', err);
        return {
          meaning: null
        };
      }
    }

}

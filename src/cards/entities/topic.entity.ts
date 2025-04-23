import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Card } from './card.entity'; // Import entity Card

@Entity('topics') // Tên bảng trong cơ sở dữ liệu là 'sets'
export class Topic {
  @PrimaryGeneratedColumn()
  topic_id: number; 

  @Column()
  topic_name: string; 

  @Column()
  topic_description: string; 
  
  @Column()
  is_default: boolean; 

  // Mối quan hệ một-đến-nhiều với Card
  @OneToMany(() => Card, (card) => card.topic)
  cards: Card[]; // Mảng các Card thuộc Set này
}
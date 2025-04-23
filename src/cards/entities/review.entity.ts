import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { User } from "../../users/entities" 
import { Card } from "./card.entity";

@Entity('user_card_reviews')
export class UserCardReview {
    @PrimaryGeneratedColumn()
    id: number;

    // Quan hệ với User
    @ManyToOne(() => User, (user) => user.cardReviews, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    // Quan hệ với Card
    @ManyToOne(() => Card, (card) => card.userReviews, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'card_id' })
    card: Card;

    // Độ dễ của card đối với người dùng
    @Column({ type: 'float', default: 2.5 })
    ease_factor: number;

    // Khoảng thời gian ôn tập (tính bằng ngày)
    @Column({ type: 'integer', default: 0 })
    interval: number;

    // Số lần ôn tập thành công liên tiếp
    @Column({ type: 'integer', default: 0 })
    repetitions: number;

    // Ngày ôn tập tiếp theo
    @Column({ type: 'date', nullable: true })
    next_review_date: Date;

    // Ngày ôn tập gần nhất
    @Column({ type: 'date', nullable: true })
    last_review_date: Date;
}
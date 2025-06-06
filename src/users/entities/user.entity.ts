import { Card, Topic, Set } from '../../cards/entities';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { UserCardReview } from '../../cards/entities';
import { UserDailyActivity } from 'src/statistics/entities';
import { Notification } from 'src/notifications/entities';

@Entity('users')
export class User {
    // Trường này auto primary key
    @PrimaryGeneratedColumn()
    id: number

    @Column({length: 100})
    name: string

    @Column({nullable: true})
    dateOfBirth: Date

    @Column({unique: true})
    email: string

    @Column()
    password: string

    @CreateDateColumn({name: 'created_at'})
    createdAt: Date

    @UpdateDateColumn({name: 'updated_at'})
    updatedAt: Date

    @Column({default: true})
    isActive: boolean

    @Column({default: false})
    isEmailVerified: boolean

    @Column({ nullable: true, length: 6 })
    verificationCode: string

    @Column({ nullable: true })
    verificationCodeExpiresAt: Date

    @Column({ nullable: true, length: 6 })
    passwordResetCode: string;

    @Column({ nullable: true })
    passwordResetCodeExpiresAt: Date;

    @Column({ nullable: true })
    defaultTopicsLoaded: boolean;

    @Column({ nullable: true })
    defaultSetsLoaded: boolean;

    @OneToMany(() => Card, (card) => card.user)
    cards: Card[];

    // Quan hệ mới với UserCardReview
    @OneToMany(() => UserCardReview, (review) => review.user)
    cardReviews: UserCardReview[];

    @Column({ nullable: true })
    lastLogin: Date;

    @OneToMany(() => Topic, (topic) => topic.user)
    topics: Topic[];

    @OneToMany(() => Set, (set) => set.user)
    sets: Set[];

    @OneToMany(() => UserDailyActivity, (activity) => activity.user)
    dailyActivities: UserDailyActivity[];

    @OneToMany(() => Notification, (notif) => notif.user)
    notifications: Notification[];
}
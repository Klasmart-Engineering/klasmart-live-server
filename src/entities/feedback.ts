import { BaseEntity, Column, Entity, PrimaryColumn, Index, CreateDateColumn, PrimaryGeneratedColumn, OneToMany, ManyToOne } from "typeorm";

enum FeedbackType {
    LeaveClass,
    EndClass,
}
@Entity()
export class Feedback extends BaseEntity {    
    @PrimaryColumn({ name: "session_id" })
    public sessionId!: string

    @CreateDateColumn({ name: "created_at"})
    public createdAt!: Date

    @Index()
    @Column({ name: "room_id", nullable: true })
    public roomId?: string
    
    @Index()
    @Column({ name: "user_id" })
    public userId!: string

    @Column({
        type: "enum",
        enum: FeedbackType,
    })
    public feedbackType!: FeedbackType

    @Column({ name: "stars" })
    public stars!: number

    @Column({ name: "message", nullable: true })
    public message?: string 

    @OneToMany(() => QuickFeedback, quickFeedback => quickFeedback.feedback)
    public quickFeedback?: QuickFeedback[];
}

enum QuickFeedbackType {
    Video,
    Auio,
    Presentation,
    Other,
}

@Entity()
export class QuickFeedback extends BaseEntity {    
    @PrimaryGeneratedColumn()
    public id!: number

    @CreateDateColumn({ name: "created_at"})
    public createdAt!: Date

    @Column({
        type: "enum",
        enum: QuickFeedbackType,
    })
    public quickFeedbackType!: QuickFeedbackType

    @Column({ name: "stars" })
    public stars!: number

    @ManyToOne(() => Feedback, feedback => feedback.quickFeedback)
    public feedback?: Feedback;
}

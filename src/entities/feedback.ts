import { BaseEntity, Column, Entity, PrimaryColumn, Index, CreateDateColumn, PrimaryGeneratedColumn, OneToMany, ManyToOne } from "typeorm";

export enum FeedbackType {
    LeaveClass = "leave_class",
    EndClass = "end_class",
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
    public type!: FeedbackType

    @Column({ name: "stars" })
    public stars!: number

    @Column({ name: "comment", nullable: true })
    public comment?: string 

    @OneToMany(() => QuickFeedback, quickFeedback => quickFeedback.feedback, { cascade: true })
    public quickFeedback?: QuickFeedback[];
}

export enum QuickFeedbackType {
    Video = "video",
    Audio = "audio",
    Presentation = "presentation",
    Other = "other",
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
    public type!: QuickFeedbackType

    @Column({ name: "stars" })
    public stars!: number

    @ManyToOne(() => Feedback, feedback => feedback.quickFeedback)
    public feedback?: Feedback;
}

import { BaseEntity, Column, Entity, PrimaryColumn, Index, CreateDateColumn } from "typeorm";

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

    @Index()
    @Column({
        type: "enum",
        enum: FeedbackType,
        default: FeedbackType.LeaveClass
    })
    public feedbackType!: FeedbackType

    @Index()
    @Column({ name: "stars" })
    public stars!: number

    @Index()
    @Column({ name: "message", nullable: true })
    public message?: string 
}

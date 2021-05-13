import { BaseEntity, Column, Entity, PrimaryColumn, Index } from "typeorm";

@Entity()
export class Attendance extends BaseEntity {    
    @PrimaryColumn({ name: "session_id" })
    public sessionId!: string

    @PrimaryColumn({ name: "join_timestamp" })
    public joinTimestamp!: Date
    
    @PrimaryColumn({ name: "leave_timestamp" })
    public leaveTimestamp!: Date

    @Index()
    @Column({ name: "room_id", nullable: true })
    public roomId?: string
    
    @Index()
    @Column({ name: "user_id" })
    public userId!: string
}
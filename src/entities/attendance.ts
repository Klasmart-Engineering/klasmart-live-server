import { BaseEntity, Column, Entity, PrimaryColumn, Index } from "typeorm";

@Entity()
export class Attendance extends BaseEntity {    
    @PrimaryColumn()
    public session_id!: string

    @PrimaryColumn()
    public join_timestamp!: Date
    
    @PrimaryColumn()
    public leave_timestamp!: Date

    @Index()
    @Column()
    public room_id?: string
    
    @Index()
    @Column({nullable: false})
    public user_id!: string
}
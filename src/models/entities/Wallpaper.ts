/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { Analytics } from './Analytics';
import { Imagekit } from './Imagekit';

@Entity()
export class Wallpaper {
  @PrimaryGeneratedColumn('uuid')
  id: number;

  @Column({
    type: 'text',
    length: 200,
  })
  filename: string;

  @Column('date')
  date: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  title: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  copyright: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  copyrightlink: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  quiz: string;

  // 0 >> zh-CN
  // 1 >> en-US
  // 2 >>
  @Column('tinyint')
  lang: number;

  // 图片后缀
  @Column({
    type: 'text',
    length: 50,
    nullable: true,
  })
  ext: string;

  // 图片MIME信息
  @Column({
    type: 'text',
    length: 100,
    nullable: true,
  })
  mime: string;

  // 一对一关联
  // 一条壁纸记录，对应1条 Analytics 记录
  @OneToOne(() => Analytics)
  @JoinColumn()
  analytics: Analytics;

  // 多对一关联
  // 多条壁纸记录，对应1条 Imagekit 记录
  @ManyToOne(() => Imagekit, (imagekit) => imagekit.wallpapers)
  imagekit: Imagekit;
}

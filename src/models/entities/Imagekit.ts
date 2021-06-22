/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Wallpaper } from './Wallpaper';

/**
 * ---------------------
 * imagekit.io
 * @doc https://docs.imagekit.io/api-reference/upload-file-api/server-side-file-upload
 */

@Entity()
export class Imagekit {
  @PrimaryGeneratedColumn('uuid')
  id: number;

  // imagekit.io中的文件ID
  @Column({
    type: 'text',
    nullable: true,
  })
  fileId: string;

  // imagekit.io中的文件名
  @Column({
    type: 'text',
    nullable: true,
  })
  fileName: string;

  // imagekit.io中的文件高度
  @Column({
    type: 'int',
    nullable: true,
  })
  height: number;

  // imagekit.io中的文件宽度
  @Column({
    type: 'int',
    nullable: true,
  })
  width: number;

  // 一对多关联
  // 1条分析记录，可能对应多张壁纸
  @OneToMany(() => Wallpaper, (wallpaper) => wallpaper.imagekit)
  wallpapers: Wallpaper[];
}

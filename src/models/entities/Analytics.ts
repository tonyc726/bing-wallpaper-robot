/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * ---------------------
 * python imagehash
 * @doc https://blog.csdn.net/kingroc/article/details/102504472
 */

@Entity()
export class Analytics {
  @PrimaryGeneratedColumn('uuid')
  id!: number;

  // 均值散列(average hashing) - aHash
  // 对图片的每个像素值进行比较，如果大于等于均值则输出1否则输出0
  @Column({
    type: 'text',
    nullable: true,
  })
  aHash!: string | null;

  // 感知散列(perception hashing) - pHash
  // 它和均值散列有些相似，但它通过频域（frequency domain）做了一个离散余弦变换（Discrete Cosine Transformation）
  @Column({
    type: 'text',
    nullable: true,
  })
  pHash!: string | null;

  // 梯度散列(gradient hashing) - dHash
  // 计算每个像素的差异，并将差异与平均差异进行比较
  @Column({
    type: 'text',
    nullable: true,
  })
  dHash!: string | null;

  // 小波散列(wavelet hashing) - wHash
  // 它的工作原理使用频域（frequency domain）类似于pHash，并使用DWT替换了DCT
  @Column({
    type: 'text',
    nullable: true,
  })
  wHash!: string | null;

  /**
   * ---------------------
   * python find-dominant-most-common-color-in-an-image
   * @doc https://stackoverflow.com/questions/3241929/python-find-dominant-most-common-color-in-an-image
   */

  // 图片主色
  @Column({
    type: 'text',
    nullable: true,
  })
  dominantColor!: string | null;
}

/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class Wallpaper {
  @PrimaryColumn({
    type: 'text',
    length: 50,
  })
  id: string;

  @Column({
    type: 'text',
    length: 200,
  })
  filename: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  title: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  address: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  copyright: string;

  // 0 >> zh-CN
  // 1 >> en-US
  // 2 >>
  @Column('tinyint')
  lang: number;

  @Column('date')
  date: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  responseTxt: string;

  /**
   * ---------------------
   * imagekit.io
   * @doc https://docs.imagekit.io/api-reference/upload-file-api/server-side-file-upload
   */

  // imagekit.io中的文件ID
  @Column({
    type: 'text',
    nullable: true,
  })
  imagekitFileId: string;

  // imagekit.io中的文件名
  @Column({
    type: 'text',
    nullable: true,
  })
  imagekitFileName: string;

  // imagekit.io中的文件高度
  @Column({
    type: 'int',
    nullable: true,
  })
  imagekitFileHeight: number;

  // imagekit.io中的文件宽度
  @Column({
    type: 'int',
    nullable: true,
  })
  imagekitFileWidth: number;

  /**
   * ---------------------
   * python imagehash
   * @doc https://blog.csdn.net/kingroc/article/details/102504472
   */

  // `https://cn.bing.com/th?id={FILE_NAME}_UHD.jpg&w=128&c=1`
  // 计算hash的图片Base64
  @Column({
    type: 'text',
    nullable: true,
  })
  hashImg: string;

  // 均值散列(average hashing) - aHash
  // 对图片的每个像素值进行比较，如果大于等于均值则输出1否则输出0
  @Column({
    type: 'text',
    nullable: true,
  })
  aHash: string;

  // 感知散列(perception hashing) - pHash
  // 它和均值散列有些相似，但它通过频域（frequency domain）做了一个离散余弦变换（Discrete Cosine Transformation）
  @Column({
    type: 'text',
    nullable: true,
  })
  pHash: string;

  // 梯度散列(gradient hashing) - dHash
  // 计算每个像素的差异，并将差异与平均差异进行比较
  @Column({
    type: 'text',
    nullable: true,
  })
  dHash: string;

  // 小波散列(wavelet hashing) - wHash
  // 它的工作原理使用频域（frequency domain）类似于pHash，并使用DWT替换了DCT
  @Column({
    type: 'text',
    nullable: true,
  })
  wHash: string;

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
  dominantColor: string;
}

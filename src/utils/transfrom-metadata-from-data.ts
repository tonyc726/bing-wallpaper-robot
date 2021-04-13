import { isNil, trim } from 'lodash';
/**
 * 从原始数据(copyright)中，匹配壁纸的元数据
 *
 * @param {string} copyrightData - 原始数据
 *
 * @returns {string} 返回壁纸的元数据
 *
 * ```typescript
 * // 生成一个 0 ~ 10 的随机整数
 * import transfromMetadataFromData from 'transfrom-metadata-from-data';
 *
 * transfromMetadataFromData('"加拿大猞猁，蒙大拿州 (© Alan and Sandy Carey/Minden Pictures)"');
 * >> [
 * >>    "Barnett Demesne公园中在白雪覆盖的山坡上玩耍的一家",
 * >>    "北爱尔兰贝尔法斯特",
 * >>    "Stephen Barnes/Alamy"
 * >> ]
 * ```
 */
export default (copyrightData: string): Array<string | undefined> => {
  if (isNil(copyrightData)) {
    return [];
  }
  // 挪威苔原上的北极光和野生驯鹿 (© Anton Petrus/Getty Images)
  let copyright = copyrightData;
  let description;
  let copyrightDataMath = copyrightData.match(/(.*)\(\s.©(.*)\)/);
  if (copyrightDataMath !== null) {
    [, description, copyright] = copyrightDataMath || [];
  }
  let address = '';
  if (description !== undefined && /\，/.test(description)) {
    [, description, address] = description.match(/(.*)\，(.*)/);
  }
  return [trim(description), trim(address), trim(copyright)];
};

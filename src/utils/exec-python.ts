import { isString } from 'lodash';
import { exec } from 'child_process';

export default (pyFilePath: string, args?: string): Promise<any> =>
  new Promise((resolve, reject) => {
    if (isString(pyFilePath) === false || pyFilePath.length === 0) {
      reject(new Error('execPython must need the python file path.'));
      return;
    }
    exec(`python ${pyFilePath} ${args}`, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      }
      if (stderr) {
        reject(stderr);
      }
      if (stdout) {
        let result = stdout;
        result = result.replace('\r\n', '');
        result = result.replace('\r', '');
        result = result.replace('\n', '');
        resolve(result);
      }
    });
  })

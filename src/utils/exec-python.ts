import { isString } from 'lodash';
import { exec } from 'child_process';
import * as path from 'path';

// Get the project root directory
const projectRoot = path.resolve(__dirname, '../../');

export default (pyFilePath: string, args?: string): Promise<any> =>
  new Promise((resolve, reject) => {
    if (isString(pyFilePath) === false || pyFilePath.length === 0) {
      reject(new Error('execPython must need the python file path.'));
      return;
    }

    // Use the Python from the virtual environment
    const venvPython = path.join(projectRoot, '.venv', 'bin', 'python3');
    const fullPyFilePath = path.isAbsolute(pyFilePath) ? pyFilePath : path.join(projectRoot, pyFilePath);

    exec(`${venvPython} ${fullPyFilePath} ${args}`, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`Python execution failed: ${err.message}`));
        return;
      }
      if (stderr) {
        reject(new Error(`Python stderr: ${stderr}`));
        return;
      }
      if (stdout) {
        let result = stdout;
        result = result.replace('\r\n', '');
        result = result.replace('\r', '');
        result = result.replace('\n', '');
        resolve(result);
      }
    });
  });

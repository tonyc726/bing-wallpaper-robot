import { isString, isNil } from 'lodash';
import { execFile } from 'child_process';
import * as path from 'path';

// Get the project root directory
const projectRoot = path.resolve(__dirname, '../../');

// Determine Python interpreter: prefer crawler/.venv if it exists, fallback to system python3
function getPythonPath(): string {
  const venvPython = path.join(projectRoot, 'crawler', '.venv', 'bin', 'python3');
  if (require('fs').existsSync(venvPython)) {
    return venvPython;
  }
  return 'python3';
}

export default (pyFilePath: string, args?: string): Promise<any> =>
  new Promise((resolve, reject) => {
    if (isString(pyFilePath) === false || pyFilePath.length === 0) {
      reject(new Error('execPython must need the python file path.'));
      return;
    }

    const pythonPath = getPythonPath();
    const fullPyFilePath = path.isAbsolute(pyFilePath) ? pyFilePath : path.join(projectRoot, pyFilePath);

    const scriptArgs = isString(args) && args.length > 0 ? args.split(' ') : [];
    execFile(pythonPath, [fullPyFilePath, ...scriptArgs], (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`Python execution failed: ${err.message}`));
        return;
      }
      if (stderr) {
        reject(new Error(`Python stderr: ${stderr}`));
        return;
      }
      if (stdout) {
        const result = stdout.replace(/\r?\n$/, '');
        resolve(result);
      }
    });
  });

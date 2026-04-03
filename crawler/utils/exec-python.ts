import { isString } from 'lodash';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Get the project root directory
const projectRoot = path.resolve(__dirname, '../../');

// Determine Python interpreter: prefer .venv if it exists, fallback to system python3
function getPythonPath(): string {
  const venvPython = path.join(projectRoot, '.venv', 'bin', 'python3');
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  // Fallback for CI environments (GitHub Actions, etc.)
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

    exec(`${pythonPath} ${fullPyFilePath} ${args}`, (err, stdout, stderr) => {
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

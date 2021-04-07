import * as core from '@actions/core';

const now = new Date();
const COMMIT_MESSAGE = `[${now.getFullYear()}/${now.getMonth()}//${now.getDate()}] 新增10条数据`;

core.setOutput('COMMIT_MESSAGE', COMMIT_MESSAGE);
core.exportVariable('COMMIT_MESSAGE', COMMIT_MESSAGE);

export default () => {};

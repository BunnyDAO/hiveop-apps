import { readFileSync } from 'node:fs';
import { buildConfig } from './src/appConfig.ts';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default buildConfig(process.env, version);

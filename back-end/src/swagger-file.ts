import { createApp } from './main';

async function writeSwagger() {
  const app = await createApp();
  await app.close();
}

void writeSwagger();

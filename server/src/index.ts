import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3002);

const app = createApp();
app.listen(PORT, '127.0.0.1', () => {
  console.log(`sakul-api listening on 127.0.0.1:${PORT}`);
});

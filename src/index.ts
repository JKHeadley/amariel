import { AmarielService } from './services/amariel-service';
import * as dotenv from 'dotenv';

dotenv.config();

const isDryRun = process.env.DRY_RUN === 'true';

const amariel = new AmarielService(
  process.env.OPENAI_API_KEY!,
  {
    apiKey: process.env.X_API_KEY!,
    apiSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET!,
    dryRun: isDryRun
  }
);

if (!isDryRun) {
  // Only set up intervals in live mode
  const checkInterval = 5 * 60 * 1000; // 5 minutes
  const thoughtInterval = 6 * 60 * 60 * 1000; // 6 hours

  // Check mentions
  setInterval(async () => {
    try {
      await amariel.checkAndRespondToMentions();
    } catch (error) {
      console.error('Error in mention check interval:', error);
    }
  }, checkInterval);

  // Share thoughts
  setInterval(async () => {
    try {
      await amariel.shareThought();
    } catch (error) {
      console.error('Error in thought sharing interval:', error);
    }
  }, thoughtInterval);
}

console.log(`Amariel bot is running in ${isDryRun ? 'console' : 'live'} mode...`); 
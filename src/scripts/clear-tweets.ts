import { PrismaClient } from '@prisma/client';

async function clearTweetsAndMentions() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Starting database cleanup...');

    // First, clear all mentions since they have foreign key references to tweets
    const deletedMentions = await prisma.mention.deleteMany();
    console.log(`Deleted ${deletedMentions.count} mentions`);

    // Then clear all tweets
    const deletedTweets = await prisma.tweet.deleteMany();
    console.log(`Deleted ${deletedTweets.count} tweets`);

    console.log('Database cleanup completed successfully');
  } catch (error) {
    console.error('Error during database cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
clearTweetsAndMentions(); 
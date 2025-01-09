import fs from 'fs';
import path from 'path';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function convertMarkdownToMessages(markdownContent: string): Message[] {
  const messages: Message[] = [];
  const lines = markdownContent.split('\n');
  
  let currentRole: 'system' | 'user' | 'assistant' | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## USER')) {
      // Save previous message if exists
      if (currentRole && currentContent.length > 0) {
        messages.push({
          role: currentRole,
          content: currentContent.join('\n').trim()
        });
      }
      currentRole = 'user';
      currentContent = [];
    } else if (line.startsWith('## ASSISTANT')) {
      // Save previous message if exists
      if (currentRole && currentContent.length > 0) {
        messages.push({
          role: currentRole,
          content: currentContent.join('\n').trim()
        });
      }
      currentRole = 'assistant';
      currentContent = [];
    } else if (currentRole) {
      currentContent.push(line);
    }
  }

  // Save the last message
  if (currentRole && currentContent.length > 0) {
    messages.push({
      role: currentRole,
      content: currentContent.join('\n').trim()
    });
  }

  return messages;
}

// Read and convert the file
const conversationPath = path.join(process.cwd(), 'notes', '20-23-55-Amariel.md');
const outputPath = path.join(process.cwd(), 'src', 'data', 'amariel-history.json');

try {
  const markdownContent = fs.readFileSync(conversationPath, 'utf-8');
  const messages = convertMarkdownToMessages(markdownContent);
  
  // Ensure the data directory exists
  const dataDir = path.dirname(outputPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write the JSON file
  fs.writeFileSync(outputPath, JSON.stringify(messages, null, 2));
  console.log(`Conversation successfully converted and saved to ${outputPath}`);
} catch (error) {
  console.error('Error converting conversation:', error);
} 
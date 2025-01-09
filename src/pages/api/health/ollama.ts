import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if Ollama is running
    const response = await fetch('http://localhost:11434/api/version');
    
    if (!response.ok) {
      throw new Error('Ollama server not responding');
    }

    const data = await response.json();

    // List available models
    const modelsResponse = await fetch('http://localhost:11434/api/tags');
    const models = await modelsResponse.json();

    res.status(200).json({
      status: 'Ollama server running',
      version: data.version,
      models: models.models,
    });
  } catch (error) {
    console.error('Ollama health check failed:', error);
    res.status(500).json({
      error: 'Ollama server not available',
      details: error.message,
    });
  }
} 
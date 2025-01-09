# Setting up Ollama for Local AI

## Prerequisites
1. Install Ollama from https://ollama.ai/
2. Pull the desired model:
   ```bash
   ollama pull llama2
   ```

## Configuration
1. Set the environment variables:
   ```env
   AI_PROVIDER_TYPE=ollama
   NEXT_PUBLIC_OLLAMA_MODEL=llama2
   ```

2. Start Ollama server:
   ```bash
   ollama serve
   ```

3. Verify Ollama is running:
   ```bash
   curl http://localhost:11434/api/version
   ```

## Available Models
- llama2
- mistral
- codellama
- llama2-uncensored
- neural-chat

To use a different model:
1. Pull the model:
   ```bash
   ollama pull mistral
   ```
2. Update the environment variable:
   ```env
   NEXT_PUBLIC_OLLAMA_MODEL=mistral
   ```

## Health Check
Visit `/api/health/ollama` to verify:
- Ollama server status
- Available models
- Server version

## Troubleshooting
1. If Ollama is not responding:
   - Check if the server is running: `ps aux | grep ollama`
   - Restart the server: `ollama serve`
   - Verify port 11434 is available: `lsof -i :11434`

2. If model is not found:
   - Pull the model again: `ollama pull <model>`
   - Check available models: `ollama list` 
OpenAI compatibility
February 8, 2024
OpenAI compatibility

Ollama now has built-in compatibility with the OpenAI Chat Completions API, making it possible to use more tooling and applications with Ollama locally.

Setup
Start by downloading Ollama and pulling a model such as Llama 2 or Mistral:

ollama pull llama2
Usage
cURL
To invoke Ollama’s OpenAI compatible API endpoint, use the same OpenAI format and change the hostname to http://localhost:11434:

curl http://localhost:11434/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "llama2",
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful assistant."
            },
            {
                "role": "user",
                "content": "Hello!"
            }
        ]
    }'
OpenAI Python library
from openai import OpenAI

client = OpenAI(
    base_url = 'http://localhost:11434/v1',
    api_key='ollama', # required, but unused
)

response = client.chat.completions.create(
  model="llama2",
  messages=[
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Who won the world series in 2020?"},
    {"role": "assistant", "content": "The LA Dodgers won in 2020."},
    {"role": "user", "content": "Where was it played?"}
  ]
)
print(response.choices[0].message.content)
OpenAI JavaScript library
import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama', // required but unused
})

const completion = await openai.chat.completions.create({
  model: 'llama2',
  messages: [{ role: 'user', content: 'Why is the sky blue?' }],
})

console.log(completion.choices[0].message.content)
Examples
Vercel AI SDK
The Vercel AI SDK is an open-source library for building conversational streaming applications. To get started, use create-next-app to clone the example repo:

npx create-next-app --example https://github.com/vercel/ai/tree/main/examples/next-openai example
cd example
Then make the following two edits in app/api/chat/route.ts to update the chat example to use Ollama:

const openai = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama',
});
const response = await openai.chat.completions.create({
  model: 'llama2',
  stream: true,
  messages,
});
Next, run the app:

npm run dev
Finally, open the example app in your browser at http://localhost:3000:

Autogen
Autogen is a popular open-source framework by Microsoft for building multi-agent applications. For this, example we’ll use the Code Llama model:

ollama pull codellama
Install Autogen:

pip install pyautogen
Then create a Python script example.py to use Ollama with Autogen:

from autogen import AssistantAgent, UserProxyAgent

config_list = [
  {
    "model": "codellama",
    "base_url": "http://localhost:11434/v1",
    "api_key": "ollama",
  }
]

assistant = AssistantAgent("assistant", llm_config={"config_list": config_list})

user_proxy = UserProxyAgent("user_proxy", code_execution_config={"work_dir": "coding", "use_docker": False})
user_proxy.initiate_chat(assistant, message="Plot a chart of NVDA and TESLA stock price change YTD.")
Lastly, run the example to have the assistant write the code to plot a chart:

python example.py
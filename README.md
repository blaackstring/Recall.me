# Recall.me - Your Semantic Visual Memory

Recall.me is an advanced Chrome Extension and backend service that acts as your personal "digital brain". It allows you to seamlessly capture screenshots of tabs you are browsing, automatically analyzes their content, and makes them semantically searchable. Instead of searching by exact filenames or dates, you can search by concepts, topics, or even feelings.

## 🚀 What is Working
- **Tab Capture**: Instantly capture the visible area of your current browser tab with a single click.
- **AI Vision Analysis**: Uses LLMs (Gemini/OpenAI) to extract detailed summaries, tags, and context from your screenshots.
- **Dual-Brain Memory Architecture**:
  - **Fast Brain (AstraDB)**: Instantly saves your screenshot and its semantic embedding vector. Powers the "Library" tab for lightning-fast semantic search.
  - **Deep Brain (Cognee)**: Asynchronously maps your screenshots into a relational Knowledge Graph, linking entities and concepts across your memories.
- **Visual Memory Agent (Agent Mode)**: A LangGraph-powered conversational agent that can reason over your memories, answer complex questions, and intelligently fall back to AstraDB if graph indexing is still processing.
- **Authentication**: Secure Google Authentication powered by Firebase.
- **Payment & Subscriptions**: Cashfree integration to manage user plan limits (Free, Basic, Standard, Premium).

## 🏗️ Architecture

The project is split into two main components: the Chrome Extension (Frontend) and the Node.js Server (Backend).

### 1. Frontend (Chrome Extension)
- **Tech Stack**: React, TypeScript, Vite, Lucide Icons.
- **Features**:
  - Injected UI popup with a modern, glassmorphic design.
  - Dual-tab interface: **Library** (for manual search and grid view) and **Agent** (for chat-based memory retrieval).
  - Background Service Worker to handle print-screen events and bridge communication between the browser tab and the API.

### 2. Backend (Node.js/Express)
- **Tech Stack**: Express, TypeScript, LangGraph, Cognee, AstraDB (DataStax), AWS S3.
- **Core Pipelines**:
  - `/process-screenshot`: 
    1. Uploads the raw image to an AWS S3 bucket (served via CloudFront).
    2. Runs AI Vision analysis to generate a rich description and tags.
    3. Generates vector embeddings for the text.
    4. Writes the data simultaneously to **AstraDB** (Vector Store) and **Cognee** (Relational Graph Store).
  - `/search`:
    - **Query Mode**: Performs a semantic vector search in AstraDB.
    - **Chat Mode**: Invokes a LangGraph workflow. The agent evaluates the user's question, determines which tool to use, and queries Cognee. If Cognee throws a 404 (because it is still processing), a smart fallback kicks in to retrieve data from AstraDB natively.

## 🧠 The Agent Workflow (LangGraph)
The Agent relies on a state machine built with LangGraph:
1. **Input**: User asks a question (e.g., "Find my AWS bill").
2. **Tool Selection**: The LLM determines it needs to search the user's visual memory and calls the `recall_tool`.
3. **Execution & Fallback**: The `recall_tool` pings Cognee's graph endpoints. If Cognee is still indexing the background job, it falls back to a Vector Similarity Search in AstraDB.
4. **Structured Output**: The workflow catches the resulting data, natively parses the image URLs and metadata, and returns a structured conversational answer alongside the actual image cards.

## 🛠️ Setup Instructions

### Extension
1. Navigate to the `extension` folder.
2. Run `npm install` and `npm run build`.
3. Go to `chrome://extensions` in your browser.
4. Enable "Developer Mode" and click "Load unpacked", selecting the `extension/dist` folder.

### Server
1. Navigate to the `server` folder.
2. Add your `.env` file (AstraDB, AWS, OpenAI, Gemini, Firebase, Cognee, Cashfree keys).
3. Run `npm install`.
4. Run `npm run dev` to start the backend on port 3001.

---
*Built to ensure you never lose a fleeting thought or an important webpage ever again.*

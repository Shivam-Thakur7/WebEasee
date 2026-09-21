# WebEase — Development Instructions

## 1. Project Overview

WebEase is an AI-powered accessibility browser extension that allows physically disabled users to interact with websites and documents using natural voice commands.

The system should support:

1. Voice-controlled browser navigation
2. Voice-controlled webpage interaction
3. Voice-based typing
4. Webpage reading
5. Document generation
6. Document reading
7. Text-to-speech responses
8. AI-powered command understanding

---

# 2. Recommended Architecture

```text
                         USER
                          │
                          ▼
                  🎤 MICROPHONE
                          │
                          ▼
                 Azure AI Speech
                  Speech → Text
                          │
                          ▼
                 Azure AI Foundry
                    LLM / Agent
                          │
                    Tool Calling
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
      Browser Tools             Document Tools
             │                         │
             ▼                         ▼
    WebEase Extension          Python Backend
             │                         │
             ▼                         ▼
          Browser                  .docx files
             │
             ▼
          Result
             │
             ▼
                 Azure AI Speech
                    Text → Speech
                          │
                          ▼
                     🔊 USER
```

---

# 3. Technology Stack

## Frontend

Use:

* HTML
* CSS
* JavaScript

For the browser extension:

* Chrome Extension Manifest V3
* JavaScript
* Chrome Extension APIs
* Content Scripts
* Background Service Worker

Do not make React mandatory for the first version.

---

# 4. Backend

Recommended:

```text
Python
FastAPI
```

Backend responsibilities:

* Receive voice commands
* Communicate with Azure
* Send commands to the LLM
* Handle tool/function calls
* Generate documents
* Process document text
* Maintain command history
* Communicate with the browser extension

Suggested structure:

```text
backend/
│
├── main.py
│
├── config.py
│
├── requirements.txt
│
├── routes/
│   ├── voice.py
│   ├── commands.py
│   ├── documents.py
│   └── history.py
│
├── services/
│   ├── speech_service.py
│   ├── foundry_service.py
│   ├── browser_service.py
│   ├── document_service.py
│   └── tts_service.py
│
├── tools/
│   ├── browser_tools.py
│   └── document_tools.py
│
└── utils/
    └── helpers.py
```

---

# 5. Azure Setup

Create an Azure account/resource group.

Configure the required Azure services.

## Required

### Azure AI Speech

Use it for:

```text
Speech → Text
Text → Speech
```

Store credentials in environment variables.

Example:

```text
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
```

---

## Azure AI Foundry

Create/use a Foundry project and deploy a suitable model.

Use the model for:

* Intent detection
* Command understanding
* Tool selection
* Content generation
* Webpage understanding
* Document generation

Store credentials/configuration using environment variables.

Never hard-code API keys.

---

# 6. Environment Variables

Create:

```text
.env
```

Example:

```text
AZURE_SPEECH_KEY=your_key
AZURE_SPEECH_REGION=your_region

AZURE_AI_ENDPOINT=your_endpoint
AZURE_AI_API_KEY=your_key
AZURE_AI_MODEL=your_model
```

Add `.env` to `.gitignore`.

Never commit API keys to GitHub.

---

# 7. Speech-to-Text

Create:

```text
services/speech_service.py
```

Responsibilities:

```text
Microphone audio
      ↓
Azure Speech
      ↓
Recognized text
```

Example result:

```text
"Search YouTube for Python tutorials"
```

The backend should then send this text to the command processing system.

---

# 8. Command Understanding

Send the recognized text to the Foundry model.

Example:

```text
User:
"Scroll down"

Model:
{
    "action": "scroll",
    "direction": "down",
    "amount": 500
}
```

Another example:

```text
User:
"Open YouTube"

Model:
{
    "action": "open_url",
    "url": "https://youtube.com"
}
```

Another:

```text
User:
"Search YouTube for Python tutorials"

Model:
{
    "action": "search",
    "query": "Python tutorials"
}
```

---

# 9. Browser Tool System

Create a controlled set of browser tools.

```text
scroll()
click()
type_text()
open_url()
search()
go_back()
go_forward()
read_page()
read_selected_text()
find_element()
```

The LLM should only be allowed to select from these predefined tools.

Do NOT allow the model to execute arbitrary JavaScript.

---

# 10. Browser Extension

Create:

```text
extension/
│
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── styles.css
└── icons/
```

---

# 11. Content Script

`content.js` is responsible for interacting with the current webpage.

Examples:

### Scroll

```javascript
window.scrollBy({
    top: 500,
    behavior: "smooth"
});
```

### Type

Find the appropriate input:

```javascript
document.querySelector("input")
```

Then insert the requested text.

### Click

Find the requested element and trigger the click.

---

# 12. Extension ↔ Backend Communication

The extension should communicate with the FastAPI backend.

Possible architecture:

```text
Extension
    │
    │ HTTP / WebSocket
    ▼
FastAPI
    │
    ▼
Azure
```

For the MVP, HTTP APIs are sufficient.

For real-time voice interaction, WebSockets can be added later.

---

# 13. Example Command Flow

User says:

```text
"Open YouTube and search for machine learning tutorials"
```

Flow:

```text
Microphone
    ↓
Azure Speech
    ↓
Text
    ↓
Foundry Model
    ↓
Intent
    ↓
open_url()
    ↓
Browser Extension
    ↓
YouTube
    ↓
search()
    ↓
Browser Extension
    ↓
Search results
```

---

# 14. Webpage Reading

Implement:

```text
read_page()
```

The extension should extract meaningful visible webpage text.

Example:

```javascript
document.body.innerText
```

Send relevant text to the backend.

The backend can:

* Clean the text
* Remove unnecessary content
* Optionally summarize it
* Send it to Azure Speech

Flow:

```text
Webpage
   ↓
DOM text
   ↓
Backend
   ↓
Optional LLM processing
   ↓
Azure TTS
   ↓
Audio
```

---

# 15. Text-to-Speech

Use Azure Speech for responses.

Example:

```text
"I found three search results."
```

Azure converts this into speech.

The user hears:

🔊 "I found three search results."

Add controls for:

* Speaking speed
* Voice
* Volume
* Pause
* Stop

---

# 16. Document Assistant

Create:

```text
services/document_service.py
```

Use Python libraries such as:

```text
python-docx
```

for `.docx` files.

---

# 17. Generate Document

User says:

```text
"Write a 500 word essay about artificial intelligence."
```

Flow:

```text
Voice
 ↓
Speech-to-Text
 ↓
Foundry
 ↓
Generate content
 ↓
Document Service
 ↓
.docx
```

The generated document should be downloadable/openable by the user.

---

# 18. Read Document

Flow:

```text
.docx
 ↓
Extract text
 ↓
Azure Speech
 ↓
Audio
```

Optional:

```text
.docx
 ↓
Extract text
 ↓
Foundry
 ↓
Summarize
 ↓
Azure Speech
```

---

# 19. Command History

Store:

```text
timestamp
user_command
detected_action
status
```

Example:

```json
{
    "command": "Scroll down",
    "action": "scroll",
    "status": "completed"
}
```

For the MVP, SQLite is sufficient.

---

# 20. Error Handling

Every command should have a clear status.

Possible states:

```text
LISTENING
PROCESSING
EXECUTING
COMPLETED
FAILED
```

Example:

```text
User:
"Click the first video"

WebEase:
"I couldn't identify the first video."
```

Never silently fail.

---

# 21. Confirmation System

For potentially important actions, WebEase should optionally ask for confirmation.

Example:

```text
User:
"Delete this document."

WebEase:
"Do you want me to delete this document?"

User:
"Yes."

WebEase:
Executes deletion.
```

For normal actions such as scrolling, searching, or reading, confirmation should not be necessary.

---

# 22. Accessibility Requirements

The extension itself must follow accessibility principles.

Implement:

* Large controls
* Keyboard accessibility
* Screen-reader labels
* High contrast
* Clear focus indicators
* Voice feedback
* Minimal interaction requirements
* Adjustable speech speed
* Adjustable font size
* Reduced animations
* Clear error messages

The user should be able to perform the majority of actions without a mouse.

---

# 23. Security

Never allow arbitrary commands from the LLM to directly execute system-level operations.

Use an allowlist:

```text
ALLOWED_TOOLS = [
    "scroll",
    "click",
    "type_text",
    "open_url",
    "search",
    "go_back",
    "go_forward",
    "read_page",
    "read_selected_text"
]
```

Validate all tool arguments before execution.

Never expose Azure API keys inside the browser extension.

---

# 24. Development Order

Build WebEase in this order:

### Phase 1 — Basic Extension

Implement:

```text
Chrome Extension
 ↓
Scroll
 ↓
Click
 ↓
Type
```

Make sure browser interaction works without AI.

---

### Phase 2 — Speech

Add:

```text
Microphone
 ↓
Azure Speech
 ↓
Text
```

Test speech recognition independently.

---

### Phase 3 — LLM

Add:

```text
Speech Text
 ↓
Foundry Model
 ↓
Structured Command
```

Test commands such as:

```text
"scroll down"
"scroll up"
"go back"
"open YouTube"
```

---

### Phase 4 — Tool Calling

Connect the LLM output to browser tools.

```text
LLM
 ↓
Tool
 ↓
Extension
 ↓
Browser
```

---

### Phase 5 — Text-to-Speech

Add Azure TTS.

WebEase should speak:

```text
"Opening YouTube."
```

---

### Phase 6 — Webpage Understanding

Implement:

```text
read_page()
find_element()
click()
type_text()
```

Test on:

* Google
* YouTube
* Wikipedia
* Simple forms

---

### Phase 7 — Document Assistant

Implement:

```text
Create document
Write document
Read document
Read aloud
```

---

### Phase 8 — Dashboard

Connect the frontend dashboard to the backend.

Display:

```text
Listening
Processing
Executing
Completed
History
```

---

# 25. MVP Feature Set

For the first working demo, implement only:

### Voice

* Speech-to-text
* Text-to-speech

### Browser

* Open website
* Search
* Scroll
* Go back
* Type
* Click
* Read page

### Documents

* Generate `.docx`
* Read `.docx`
* Read aloud

### AI

* Natural language understanding
* Tool/function calling

---

# 26. Demo Scenario

The final demo should show one continuous workflow.

User says:

> "Open YouTube."

WebEase opens YouTube.

User says:

> "Search for Python machine learning tutorials."

WebEase searches.

User says:

> "Open the first video."

WebEase identifies and opens it.

User says:

> "Read the page."

WebEase extracts the content.

Azure Speech reads the content aloud.

Then:

User says:

> "Create a document about what machine learning is."

Foundry generates the content.

WebEase creates a Word document.

Finally:

User says:

> "Read the document."

Azure Speech reads the document aloud.

---

# 27. Final Architecture

```text
                    WEBEASE
                       │
        ┌──────────────┴──────────────┐
        │                             │
   Browser Extension             Web Dashboard
        │                             │
        └──────────────┬──────────────┘
                       │
                    FastAPI
                       │
             ┌─────────┴─────────┐
             │                   │
       Azure Speech        Azure AI Foundry
             │                   │
       ┌─────┴─────┐       ┌─────┴──────┐
       │           │       │            │
      STT         TTS     LLM       Tool Calling
                               │
                    ┌──────────┴──────────┐
                    │                     │
              Browser Tools         Document Tools
                    │                     │
                    ▼                     ▼
                 Browser                DOCX
```

---

# 28. Important Development Principle

Do not build everything simultaneously.

First make:

```text
Voice → Text
```

Then:

```text
Text → Intent
```

Then:

```text
Intent → Tool
```

Then:

```text
Tool → Browser Action
```

Finally:

```text
Action → Voice Feedback
```

This gives:

```text
🎤
 ↓
Speech
 ↓
🧠 AI
 ↓
🔧 Tool
 ↓
🌐 Browser
 ↓
🔊 Response
```

That is the core WebEase system.

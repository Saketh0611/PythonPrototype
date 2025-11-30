# 🧩 Real-Time Pair Programming Prototype

A full-stack prototype of a real-time collaborative Python editor using **React + TypeScript + Redux**, **Monaco Editor**, **FastAPI**, **WebSockets**, and a lightweight **SQLite database**.

This project demonstrates:

* Real-time code synchronization across multiple users
* Live cursor sharing
* Basic rule-based autocomplete
* Room creation/joining
* Theme switching
* Shareable room IDs

---

# 🚀 Tech Stack

### **Frontend**

* **React (Vite)**
* **TypeScript**
* **Redux Toolkit**
* **Monaco Editor**
* **WebSockets**
* **CSS modules**

### **Backend**

* **FastAPI**
* **WebSockets**
* **SQLAlchemy + SQLite**
* **Pydantic**
* **Uvicorn**
* **CORS middleware**

---

# 📦 Requirements

Before running the project, install:

### **Backend requirements**

* Python **3.10+**
* pip
* virtualenv (optional but recommended)

### **Frontend requirements**

* Node.js **18+**
* npm or yarn

---

# ▶️ How to Run the Project (Both Services)

## **1. Clone the Repository**

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <repo-name>
```

---

## **2. Run Backend (FastAPI)**

### Step 1 — Create and activate virtual environment:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate    # Mac / Linux
venv\Scripts\activate       # Windows
```

### Step 2 — Install dependencies:

```bash
pip install -r requirements.txt
```

### Step 3 — Run the FastAPI server:

```bash
uvicorn app.main:app --reload
```

Backend will start at:

```
http://127.0.0.1:8000
```

---

## **3. Run Frontend (React + Vite)**

### Step 1 — Install dependencies:

```bash
cd frontend
npm install
```

### Step 2 — Start the development server:

```bash
npm run dev
```

Frontend will start at:

```
http://localhost:5173
```

---

# 🧱 Architecture & Design Choices

This project has 2 independent but connected services:

---

## **1️⃣ Backend Architecture (FastAPI)**

### **a. REST API**

* `/rooms/`

  * Create a room
  * Join a room

* `/autocomplete/`

  * Simple rule-based autocomplete suggestions

### **b. WebSocket Server**

* Path: `/ws/{room_id}`
* Handles:

  * Real-time code updates
  * Live cursor sharing
* All connected users in the same room receive updates instantly.

### **c. Database**

* SQLite file (`app.db`)
* Stores:

  * Room ID
  * Latest version of code
* Keeps persistence even when server restarts.

---

## **2️⃣ Frontend Architecture (React + TS)**

### **a. State Management (Redux Toolkit)**

Slices:

* `roomSlice` — manages room ID, join/create flow
* `editorSlice` — stores shared code

### **b. Monaco Editor Integration**

* Custom IntelliSense-style suggestions
* Snippets for:

  * for
  * while
  * if
  * def
  * print
* Cursor placed automatically inside parentheses.

### **c. WebSocket Sync**

* Every keystroke is broadcast to other users (debounced)
* Cursor position shared per user
* Uses unique `clientId` per browser tab

### **d. UI/UX Enhancements**

* Dark/Light theme toggle
* Copy Room ID button
* Auto centering layout
* Realtime room status indicator

---

# 🌱 What I Would Improve With More Time

### **1. LLM-based Autocomplete**

Replace the rule-based system with:

* GPT-style model
* or HuggingFace CodeGen
* or OpenAI’s function calling

### **2. CRDT or OT Collaboration**

Current syncing is “last write wins”.
Would replace with:

* **Y.js**
* **Automerge**
* **ShareDB**

This allows Google Docs-style conflict-free editing.

### **3. Authentication**

Add login so rooms are assigned to users.

### **4. Better UI**

* Display multiple live cursors inside Monaco
* Show collaborator names
* Add chat panel

### **5. Room Expiry & Cleanup**

Delete inactive rooms to keep DB clean.

---

# ⚠️ Limitations

### **1. No True Conflict Resolution**

If two users type at exactly the same position, the latest update wins.

### **2. Autocomplete Is Rule-Based**

Very simple logic:

* Checks for “for”, “if”, “wh”, “pr”, “def”
* Not ML-powered

### **3. In-Memory WebSocket State**

If server restarts:

* Active WebSocket sessions close
* Users need to reconnect

### **4. SQLite is Single-User**

Works fine locally, but:

* Not ideal for heavy traffic
* Cannot scale horizontally

### **5. No Auth / Security**

Anyone with a room ID can join it.

---

# 📘 Summary

This project demonstrates a working **real-time collaborative coding environment** built from scratch using modern tools. It highlights:

* Backend API + WS communication
* Frontend state management
* Real-time sync
* Monaco Editor customization

It is built for learning, prototyping, and showcasing real-time communication skills.


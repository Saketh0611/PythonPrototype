import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "./store/store";
import {
  createRoom,
  joinRoom,
  setConnected,
  setDisconnected,
} from "./store/roomSlice";
import { setCode } from "./store/editorSlice";
import Editor from "@monaco-editor/react";
import "./App.css";

const API_BASE = "http://127.0.0.1:8000";

type Theme = "vs-dark" | "vs-light";

interface PeerCursor {
  lineNumber: number;
  column: number;
}

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  const roomId = useSelector((state: RootState) => state.room.roomId);
  const roomStatus = useSelector((state: RootState) => state.room.status);
  const roomError = useSelector((state: RootState) => state.room.error);
  const code = useSelector((state: RootState) => state.editor.code);

  const [joinInput, setJoinInput] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>("vs-dark");
  const [peerCursors, setPeerCursors] = useState<
    Record<string, PeerCursor>
  >({});

  const wsRef = useRef<WebSocket | null>(null);
  const sendTimeout = useRef<number | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null); // for autosuggestion

  // Unique client id per browser tab
  const clientIdRef = useRef<string>("");
  if (!clientIdRef.current) {
    clientIdRef.current =
      (crypto as any)?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  const logMsg = (msg: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const setWsConnected = (connected: boolean) => {
    if (connected) {
      dispatch(setConnected());
    } else {
      dispatch(setDisconnected());
    }
  };

  const connectWebSocket = (roomId: string, initialCode?: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    const url = `ws://127.0.0.1:8000/ws/${roomId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      logMsg(`WebSocket connected to room ${roomId}`);
      setWsConnected(true);
      if (initialCode !== undefined) {
        dispatch(setCode(initialCode));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "init") {
          logMsg("Received init code from server");
          dispatch(setCode(data.code || ""));
        } else if (data.type === "code_update") {
          logMsg("Received code_update from server");
          dispatch(setCode(data.code || ""));
        } else if (data.type === "cursor") {
          const { clientId, lineNumber, column } = data;
          if (!clientId || clientId === clientIdRef.current) return;
          setPeerCursors((prev) => ({
            ...prev,
            [clientId]: { lineNumber, column },
          }));
        } else {
          logMsg(`Received message: ${event.data}`);
        }
      } catch {
        logMsg(`Error parsing message: ${event.data}`);
      }
    };

    ws.onclose = () => {
      logMsg("WebSocket closed");
      setWsConnected(false);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error", err);
      logMsg("WebSocket error");
      setWsConnected(false);
    };
  };

  // When roomId changes from thunks, connect the socket
  useEffect(() => {
    if (!roomId) return;
    connectWebSocket(roomId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const handleCreateRoom = async () => {
    const resultAction = await dispatch(createRoom());
    if (createRoom.fulfilled.match(resultAction)) {
      const { roomId, code } = resultAction.payload;
      setJoinInput(roomId);
      logMsg(`Created room ${roomId}`);
      connectWebSocket(roomId, code);
    } else {
      logMsg("Error creating room");
    }
  };

  const handleJoinRoom = async () => {
    if (!joinInput.trim()) {
      alert("Enter a room ID to join.");
      return;
    }
    const resultAction = await dispatch(joinRoom(joinInput.trim()));
    if (joinRoom.fulfilled.match(resultAction)) {
      const { roomId, code } = resultAction.payload;
      logMsg(`Joined room ${roomId}`);
      connectWebSocket(roomId, code);
    } else {
      logMsg("Error joining room");
    }
  };

  // Autocomplete called only when user clicks the button (backend)
  const triggerAutocomplete = async () => {
    if (!roomId) {
      alert("Create or join a room first.");
      return;
    }

    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) {
      return;
    }

    // Use Monaco model text as source of truth
    const fullText: string = model.getValue();
    const pos = editor.getPosition();
    let cursorIndex = fullText.length;
    let wordStartIndex = cursorIndex;

    if (pos) {
      cursorIndex = model.getOffsetAt(pos);
      const beforeCursor = fullText.slice(0, cursorIndex);
      const match = beforeCursor.match(/[\w_]+$/); // last word before cursor
      const currentWord = match ? match[0] : "";
      wordStartIndex = cursorIndex - currentWord.length;
    }

    try {
      const res = await fetch(`${API_BASE}/autocomplete/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: fullText,
          cursorPosition: cursorIndex,
          language: "python",
        }),
      });
      if (!res.ok) throw new Error("Autocomplete failed");
      const data = (await res.json()) as { suggestion: string };

      const suggestion = data.suggestion || "";
      if (!suggestion) return;

      // Replace the current word in the editor using Monaco edits
      const startPos = model.getPositionAt(wordStartIndex);
      const endPos = model.getPositionAt(cursorIndex);

      editor.executeEdits("autocomplete", [
        {
          range: {
            startLineNumber: startPos.lineNumber,
            startColumn: startPos.column,
            endLineNumber: endPos.lineNumber,
            endColumn: endPos.column,
          },
          text: suggestion,
          forceMoveMarkers: true,
        },
      ]);

      // Model is now updated with suggestion
      const updatedText: string = model.getValue();

      logMsg(`Autocomplete (button) applied: ${JSON.stringify(suggestion)}`);

      // Move cursor to condition place: inside the first "()"
      {
        // Default: end of inserted suggestion
        let targetOffsetGlobal = wordStartIndex + suggestion.length;

        const parenIndex = suggestion.indexOf("()");
        if (parenIndex >= 0) {
          // position between '(' and ')'
          targetOffsetGlobal = wordStartIndex + parenIndex + 1;
        }

        const newPos = model.getPositionAt(targetOffsetGlobal);
        editor.setPosition(newPos);
        editor.focus();
      }

      // Sync Redux and broadcast over WebSocket
      dispatch(setCode(updatedText));

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "code_update", code: updatedText })
        );
        logMsg("Sent code_update after autocomplete");
      }
    } catch (err: any) {
      console.error(err);
      logMsg(`Autocomplete error: ${err.message}`);
    }
  };

  const handleAutocomplete = () => {
    void triggerAutocomplete();
  };

  // Called when Monaco content changes (user typing)
  const handleCodeChange = (newCode: string) => {
    dispatch(setCode(newCode));

    // Debounce sending code over WebSocket (300ms)
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (sendTimeout.current) {
      window.clearTimeout(sendTimeout.current);
    }

    sendTimeout.current = window.setTimeout(() => {
      wsRef.current?.send(
        JSON.stringify({ type: "code_update", code: newCode })
      );
      logMsg("Sent code_update");
    }, 300);
  };

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === "vs-dark" ? "vs-light" : "vs-dark"));
  };

  const handleShareLink = async () => {
    if (!roomId) {
      alert("Create or join a room first.");
      return;
    }

    try {
      await navigator.clipboard.writeText(roomId);
      alert("Room ID copied!");
    } catch {
      window.prompt("Copy this Room ID:", roomId);
    }
  };

  return (
    <div className={`page-wrapper ${theme === "vs-light" ? "light" : "dark"}`}>
      <div className="app-container">
        <h1>Real-time Pair Programming</h1>

        <section className="panel">
          <h2>Room</h2>
          <div className="row">
            <button onClick={handleCreateRoom}>Create Room</button>
            <span className="room-label">
              {roomId ? `Current Room ID: ${roomId}` : "No room yet"}
            </span>
          </div>

          <div className="row">
            <input
              type="text"
              placeholder="Enter room ID to join"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
            />
            <button onClick={handleJoinRoom}>Join Room</button>
            <button onClick={handleShareLink} disabled={!roomId}>
              Copy Room ID
            </button>
          </div>

          <div className="row">
            <span>
              Status:{" "}
              <strong
                className={
                  roomStatus === "connected"
                    ? "status-connected"
                    : "status-idle"
                }
              >
                {roomStatus}
              </strong>
            </span>
            {roomError && <span className="error">Error: {roomError}</span>}
          </div>

          <div className="row">
            <button onClick={handleThemeToggle}>
              Switch to {theme === "vs-dark" ? "Light" : "Dark"} Theme
            </button>
          </div>
        </section>

        <section className="panel">
          <h2>Code Editor</h2>
          <Editor
            height="400px"
            defaultLanguage="python"
            value={code}
            onChange={(value) => handleCodeChange(value || "")}
            theme={theme}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              monacoRef.current = monaco;

              // 1) Broadcast cursor position on movement (for collaborators)
              editor.onDidChangeCursorPosition((e: any) => {
                if (
                  !wsRef.current ||
                  wsRef.current.readyState !== WebSocket.OPEN
                ) {
                  return;
                }
                const pos = e.position;
                wsRef.current.send(
                  JSON.stringify({
                    type: "cursor",
                    clientId: clientIdRef.current,
                    lineNumber: pos.lineNumber,
                    column: pos.column,
                  })
                );
              });

              // 2) Register auto-suggestions (IntelliSense-style)
              monaco.languages.registerCompletionItemProvider("python", {
                triggerCharacters: [" ", "(", "\n"],

                provideCompletionItems: (model: any, position: any) => {
                  const wordInfo = model.getWordUntilPosition(position);
                  const range = {
                    startLineNumber: position.lineNumber,
                    startColumn: wordInfo.startColumn,
                    endLineNumber: position.lineNumber,
                    endColumn: wordInfo.endColumn,
                  };

                  const prefix = wordInfo.word.toLowerCase();
                  const suggestions: any[] = [];

                  const pushSnippet = (
                    label: string,
                    insertText: string,
                    detail: string
                  ) => {
                    suggestions.push({
                      label,
                      kind: monaco.languages.CompletionItemKind.Snippet,
                      insertText,
                      insertTextRules:
                        monaco.languages.CompletionItemInsertTextRule
                          .InsertAsSnippet,
                      range,
                      detail,
                    });
                  };

                  // for / fo
                  if ("for".startsWith(prefix) && prefix.length > 0) {
                    pushSnippet(
                      "for loop",
                      "for i in range($1): {\n    $0\n}\n",
                      "for i in range(...): { ... }"
                    );
                  }

                  // while / wh
                  if ("while".startsWith(prefix) && prefix.length > 0) {
                    pushSnippet(
                      "while loop",
                      "while ($1): {\n    $0\n}\n",
                      "while ($1): { ... }"
                    );
                  }

                  // if / i
                  if ("if".startsWith(prefix) && prefix.length > 0) {
                    pushSnippet(
                      "if statement",
                      "if ($1): {\n    $0\n}\n",
                      "if ($1): { ... }"
                    );
                  }

                  // def / de
                  if ("def".startsWith(prefix) && prefix.length > 0) {
                    pushSnippet(
                      "function definition",
                      "def my_func($1): {\n    $0\n}\n",
                      "def my_func(...): { ... }"
                    );
                  }

                  // print / pr
                  if ("print".startsWith(prefix) && prefix.length > 0) {
                    pushSnippet("print", "print($1)", "print(...)");
                  }

                  return { suggestions };
                },
              });
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 16,
              fontFamily: "Fira Code, monospace",
              scrollBeyondLastLine: false,
              padding: { top: 16 },
              quickSuggestions: true,
              suggestOnTriggerCharacters: true,
            }}
          />
          <div className="row">
            <button onClick={handleAutocomplete}>Autocomplete</button>
          </div>

          <div className="cursor-row">
            {Object.entries(peerCursors).map(([clientId, pos], idx) => (
              <span key={clientId} className="cursor-pill">
                User {idx + 1}: line {pos.lineNumber}, col {pos.column}
              </span>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Log</h2>
          <pre className="log">
            {log.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </pre>
        </section>
      </div>
    </div>
  );
};

export default App;

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

const API_BASE = "http://127.0.0.1:8000";

export interface RoomState {
  roomId: string | null;
  status: "idle" | "loading" | "connected" | "error";
  error: string | null;
}

const initialState: RoomState = {
  roomId: null,
  status: "idle",
  error: null,
};

export interface RoomResponse {
  roomId: string;
  code: string;
}

// POST /rooms/
export const createRoom = createAsyncThunk<RoomResponse>(
  "room/createRoom",
  async () => {
    const res = await fetch(`${API_BASE}/rooms/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      throw new Error("Failed to create room");
    }
    return (await res.json()) as RoomResponse;
  }
);

// GET /rooms/{id}
export const joinRoom = createAsyncThunk<RoomResponse, string>(
  "room/joinRoom",
  async (roomId: string) => {
    const res = await fetch(`${API_BASE}/rooms/${roomId}`);
    if (!res.ok) {
      throw new Error("Room not found");
    }
    return (await res.json()) as RoomResponse;
  }
);

const roomSlice = createSlice({
  name: "room",
  initialState,
  reducers: {
    setConnected(state) {
      state.status = "connected";
      state.error = null;
    },
    setDisconnected(state) {
      state.status = "idle";
    },
    setRoomId(state, action: PayloadAction<string | null>) {
      state.roomId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createRoom.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(createRoom.fulfilled, (state, action) => {
        state.status = "connected";
        state.roomId = action.payload.roomId;
        state.error = null;
      })
      .addCase(createRoom.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message || "Error creating room";
      })
      .addCase(joinRoom.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(joinRoom.fulfilled, (state, action) => {
        state.status = "connected";
        state.roomId = action.payload.roomId;
        state.error = null;
      })
      .addCase(joinRoom.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message || "Error joining room";
      });
  },
});

export const { setConnected, setDisconnected, setRoomId } = roomSlice.actions;

export default roomSlice.reducer;

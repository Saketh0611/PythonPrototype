import { configureStore } from "@reduxjs/toolkit";
import roomReducer from "./roomSlice";
import editorReducer from "./editorSlice";

export const store = configureStore({
  reducer: {
    room: roomReducer,
    editor: editorReducer,
  },
});

// Types for hooks
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

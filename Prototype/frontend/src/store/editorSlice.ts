import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

const editorSlice = createSlice({
  name: "editor",
  initialState: {
    code: "",
  },
  reducers: {
    setCode(state, action: PayloadAction<string>) {
      state.code = action.payload;
    },
  },
});

export const { setCode } = editorSlice.actions;
export default editorSlice.reducer;

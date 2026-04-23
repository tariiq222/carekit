import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface BrandingState {
  primaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  clinicName: string | null;
  isLoaded: boolean;
}

interface BrandingPayload {
  primaryColor?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  clinicName?: string | null;
}

const initialState: BrandingState = {
  primaryColor: null,
  accentColor: null,
  logoUrl: null,
  clinicName: null,
  isLoaded: false,
};

const brandingSlice = createSlice({
  name: 'branding',
  initialState,
  reducers: {
    setBranding(state, action: PayloadAction<BrandingPayload>) {
      state.primaryColor = action.payload.primaryColor ?? null;
      state.accentColor = action.payload.accentColor ?? null;
      state.logoUrl = action.payload.logoUrl ?? null;
      state.clinicName = action.payload.clinicName ?? null;
      state.isLoaded = true;
    },
    clearBranding(state) {
      state.primaryColor = null;
      state.accentColor = null;
      state.logoUrl = null;
      state.clinicName = null;
      state.isLoaded = false;
    },
  },
});

export const { setBranding, clearBranding } = brandingSlice.actions;
export default brandingSlice.reducer;

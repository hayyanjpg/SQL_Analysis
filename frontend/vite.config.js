import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Pisahkan pustaka besar agar layar masuk tidak perlu mengunduh
        // seluruh aplikasi (grafik, riwayat, unggah) sebelum login.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("@supabase")) return "supabase";
          return "vendor";
        },
      },
    },
  },
});

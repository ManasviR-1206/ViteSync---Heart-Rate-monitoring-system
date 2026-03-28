import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/socket.io": {
        target: "http://localhost:5000",
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
      },
      "/health": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ["@mediapipe/face_mesh", "@mediapipe/camera_utils"],
  },
});

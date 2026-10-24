import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Test della logica pura (src/lib/**): ambiente Node, nessun DOM.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

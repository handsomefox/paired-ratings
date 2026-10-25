import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";

// A new build waits until the reader chooses to reload, so a background update
// never throws away a half-written comment.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    toast("A new version is available.", {
      duration: Infinity,
      action: { label: "Reload", onClick: () => void updateSW(true) },
    });
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

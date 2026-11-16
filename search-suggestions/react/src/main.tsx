import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Shared with the plain-JS prototype so both versions look the same.
import "../../css/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

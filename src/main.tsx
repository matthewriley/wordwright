import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/tokens.css";
// Applies the persisted theme/accent to <html> as a side effect of import,
// ahead of the render call below — avoids a flash of the wrong theme.
import "./preferences";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

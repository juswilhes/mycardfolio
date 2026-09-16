import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { reportError } from "./lib/reportError.js";
import "./index.css";

// Fängt Fehler ab, die NICHT über eine React-Render-Fehlergrenze laufen
// (z.B. in einem Event-Handler oder einer async-Funktion) - meldet sie
// ans Backend, statt dass ein Fehler nur als leere/hängende Seite bei der
// Nutzerin sichtbar wird und für uns unsichtbar bleibt.
window.addEventListener("error", (e) => reportError(e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => reportError(e.reason));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

import "./index.css";

import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter, useRoutes } from "react-router";
import routes from "~react-pages";
import { AuthProvider } from "@/contexts";

// Use HashRouter for extension builds (no server-side routing)
const isExtension = import.meta.env.VITE_IS_EXTENSION === "true";
const Router = isExtension ? HashRouter : BrowserRouter;

// eslint-disable-next-line react-refresh/only-export-components
function App() {
  return <Suspense fallback={<p>...</p>}>{useRoutes(routes)}</Suspense>;
}

const app = createRoot(document.getElementById("root")!);

app.render(
  // Temporarily disable StrictMode to debug data loading issue
  // <StrictMode>
  <Router>
    <AuthProvider>
      <App />
    </AuthProvider>
  </Router>,
  // </StrictMode>,
);

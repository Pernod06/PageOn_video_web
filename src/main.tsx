import "./index.css";

import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useRoutes } from "react-router";
import routes from "~react-pages";

// eslint-disable-next-line react-refresh/only-export-components
function App() {
  return <Suspense fallback={<p>...</p>}>{useRoutes(routes)}</Suspense>;
}

const app = createRoot(document.getElementById("root")!);

app.render(
  // Temporarily disable StrictMode to debug data loading issue
  // <StrictMode>
  <BrowserRouter>
    <App />
  </BrowserRouter>,
  // </StrictMode>,
);

import { renderToString } from "react-dom/server";
import App from "../src/App.tsx";

try {
  const html = renderToString(<App />);
  console.log("RENDER OK, html length:", html.length);
} catch (e) {
  console.error("RENDER FAILED:", e);
  process.exit(1);
}

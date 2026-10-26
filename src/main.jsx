import { createRoot } from "react-dom/client";
import "./styles.css";
import "./dashboard.css";
import { App } from "./app.jsx";
import { loadSupportChat } from "./support.js";

createRoot(document.getElementById("root")).render(<App />);
loadSupportChat();

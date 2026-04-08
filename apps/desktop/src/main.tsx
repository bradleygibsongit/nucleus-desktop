import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { TooltipProvider } from "@/features/shared/components/ui/tooltip"

// Apply system theme preference
function applyTheme() {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  document.documentElement.classList.toggle("dark", isDark)
}

// Apply on load
applyTheme()

// Disable tab-key focus cycling globally
window.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault()
  }
})

// Listen for system theme changes
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>
)

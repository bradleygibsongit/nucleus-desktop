import { useState } from "react"
import { LeftSidebar } from "./LeftSidebar"
import { MainContent } from "./MainContent"
import { RightSidebar } from "./RightSidebar"
import { SidebarProvider } from "./SidebarContext"
import { RightSidebarProvider } from "./RightSidebarContext"
import type { SettingsSectionId } from "@/features/settings/config"

export function AppLayout() {
  const [activeView, setActiveView] = useState<"chat" | "settings">("chat")
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>("general")

  return (
    <SidebarProvider>
      <RightSidebarProvider>
        <div className="flex h-screen overflow-hidden bg-transparent">
          <LeftSidebar
            activeView={activeView}
            activeSettingsSection={activeSettingsSection}
            onOpenChat={() => setActiveView("chat")}
            onOpenSettings={() => setActiveView("settings")}
            onSelectSettingsSection={setActiveSettingsSection}
          />
          <MainContent
            activeView={activeView}
            activeSettingsSection={activeSettingsSection}
          />
          <RightSidebar activeView={activeView} />
        </div>
      </RightSidebarProvider>
    </SidebarProvider>
  )
}

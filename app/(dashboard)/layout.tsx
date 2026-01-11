"use client";

import * as React from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { BottomNav } from "@/components/dashboard/bottom-nav";
import { Header } from "@/components/dashboard/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar - Static flex item, no scroll */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header - Sticky at top */}
        <Header />

        {/* Page Content - Only this area scrolls */}
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

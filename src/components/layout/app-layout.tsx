import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { Topbar } from "./topbar";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { MobileNavProvider } from "./mobile-nav-context";

/**
 * Global authenticated layout.
 * - Fixed sidebar (256px) on md+, drawer on mobile
 * - Sticky topbar (64px)
 * - Auto breadcrumb above every page
 * - Single <main> landmark (a11y)
 */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <MobileNavProvider>
      <div className="min-h-screen bg-background">
        <AppSidebar />
        <div className="md:pl-64">
          <Topbar />
          <div className="border-b border-border/60 bg-background/60 px-4 py-2 sm:px-6 lg:px-8">
            <BreadcrumbNav />
          </div>
          <main
            id="main-content"
            className="px-4 py-8 sm:px-6 lg:px-8"
          >
            {children}
          </main>
        </div>
      </div>
    </MobileNavProvider>
  );
}


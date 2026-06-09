import { Suspense } from "react";

import { Outlet } from "react-router";

import { Separator } from "@/shared/ui/kit/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/shared/ui/kit/sidebar";
import { TooltipProvider } from "@/shared/ui/kit/tooltip";
import { AppSidebar } from "@/shared/ui/sidebar";

export const MainLayout = () => {
  return (
    <>
      <SidebarProvider>
        <TooltipProvider>
          <AppSidebar />
        </TooltipProvider>
        <SidebarInset className="overflow-hidden">
          <header className="bg-accent flex h-16 shrink-0 items-center transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
            </div>
          </header>
          <Separator />
          {/* <div className="flex max-w-full flex-1 flex-col gap-4 p-4 pt-0">
            <div className="grid auto-rows-min gap-4 md:grid-cols-3">
              <div className="bg-muted/50 aspect-video rounded-xl" />
              <div className="bg-muted/50 aspect-video rounded-xl" />
              <div className="bg-muted/50 aspect-video rounded-xl" />
            </div>
          </div> */}
          <main className="flex flex-col px-4 py-2">
            <Suspense
              fallback={
                <div className="bg-muted/50 min-h-screen flex-1 rounded-xl md:min-h-min" />
              }>
              <Outlet />
            </Suspense>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
};

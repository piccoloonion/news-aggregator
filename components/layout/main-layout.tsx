import type { ReactNode } from "react";
import type { Category } from "@/types/news-types";
import { TopBar } from "@/components/layout/top-bar";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

interface MainLayoutProps {
  children: ReactNode;
  category: Category;
  searchQuery: string;
  onCategoryChange: (cat: Category) => void;
  onSearchChange: (query: string) => void;
}

export function MainLayout({
  children,
  category,
  searchQuery,
  onCategoryChange,
  onSearchChange,
}: MainLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar category={category} onCategoryChange={onCategoryChange} />
      <div className="flex flex-1 flex-col">
        <TopBar searchQuery={searchQuery} onSearchChange={onSearchChange} />
        <main className="flex-1 p-4 pb-20 md:p-6">
          {children}
        </main>
        <MobileBottomNav category={category} onCategoryChange={onCategoryChange} />
      </div>
    </div>
  );
}

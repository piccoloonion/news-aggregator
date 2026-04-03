import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Cpu, Briefcase, Trophy } from "lucide-react";
import type { Category } from "@/types/news";

interface DesktopSidebarProps {
  category: Category;
  onCategoryChange: (cat: Category) => void;
}

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode }[] = [
  { id: "global", label: "Global", icon: <Globe className="h-4 w-4" /> },
  { id: "technology", label: "Technology", icon: <Cpu className="h-4 w-4" /> },
  { id: "business", label: "Business", icon: <Briefcase className="h-4 w-4" /> },
  { id: "sports", label: "Sports", icon: <Trophy className="h-4 w-4" /> },
];

export function DesktopSidebar({ category, onCategoryChange }: DesktopSidebarProps) {
  return (
    <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 md:border-r md:border-border/50 md:bg-card/50">
      <div className="flex h-14 items-center border-b border-border/50 px-4">
        <h2 className="font-bold tracking-tight">NewsFeed</h2>
      </div>
      <Tabs
        value={category}
        onValueChange={(v) => onCategoryChange(v as Category)}
        className="flex-1 p-3"
        orientation="vertical"
      >
        <TabsList className="flex flex-col items-stretch gap-1 bg-transparent p-0">
          {CATEGORIES.map((cat) => (
            <TabsTrigger
              key={cat.id}
              value={cat.id}
              className="justify-start gap-2 rounded-md px-3 py-2.5 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
            >
              {cat.icon}
              <span className="text-sm font-medium">{cat.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </aside>
  );
}

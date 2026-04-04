import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Cpu, Briefcase, Trophy } from "lucide-react";
import type { Category } from "@/types/news-types";

interface MobileBottomNavProps {
  category: Category;
  onCategoryChange: (cat: Category) => void;
}

export function MobileBottomNav({ category, onCategoryChange }: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-sm md:hidden">
      <Tabs value={category} onValueChange={(v) => onCategoryChange(v as Category)}>
        <TabsList className="grid w-full grid-cols-4 bg-transparent p-0 h-14">
          {[
            { id: "global", label: "Global", icon: <Globe className="h-5 w-5" /> },
            { id: "technology", label: "Tech", icon: <Cpu className="h-5 w-5" /> },
            { id: "business", label: "Biz", icon: <Briefcase className="h-5 w-5" /> },
            { id: "sports", label: "Sports", icon: <Trophy className="h-5 w-5" /> },
          ].map((cat) => (
            <TabsTrigger
              key={cat.id}
              value={cat.id}
              className="flex flex-col items-center gap-0.5 rounded-none data-[state=active]:bg-transparent data-[state=active]:text-foreground"
            >
              {cat.icon}
              <span className="text-[10px] font-medium">{cat.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </nav>
  );
}

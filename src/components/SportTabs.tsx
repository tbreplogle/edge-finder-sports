
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FootballIcon, BaseballIcon, BasketballIcon } from "./SportIcons";
import { cn } from "@/lib/utils";

interface SportTabsProps {
  children?: React.ReactNode;
  activeTab?: string;
  onTabChange?: (value: string) => void;
}

export function SportTabs({ children, activeTab = "nfl", onTabChange }: SportTabsProps) {
  const handleTabChange = (value: string) => {
    if (onTabChange) {
      onTabChange(value);
    }
  };

  return (
    <Tabs defaultValue={activeTab} onValueChange={handleTabChange}>
      <TabsList className="grid grid-cols-4 mb-6">
        <TabsTrigger value="nfl" className="flex items-center gap-2">
          <FootballIcon className={cn("w-4 h-4", activeTab === "nfl" ? "text-edge-nfl" : "")} />
          <span className="hidden sm:inline">NFL</span>
        </TabsTrigger>
        <TabsTrigger value="ncaaf" className="flex items-center gap-2">
          <FootballIcon className={cn("w-4 h-4", activeTab === "ncaaf" ? "text-edge-ncaaf" : "")} />
          <span className="hidden sm:inline">NCAAF</span>
        </TabsTrigger>
        <TabsTrigger value="ncaab" className="flex items-center gap-2">
          <BasketballIcon className={cn("w-4 h-4", activeTab === "ncaab" ? "text-edge-ncaab" : "")} />
          <span className="hidden sm:inline">NCAAB</span>
        </TabsTrigger>
        <TabsTrigger value="mlb" className="flex items-center gap-2">
          <BaseballIcon className={cn("w-4 h-4", activeTab === "mlb" ? "text-edge-mlb" : "")} />
          <span className="hidden sm:inline">MLB</span>
        </TabsTrigger>
      </TabsList>
      
      {children ? (
        children
      ) : (
        <>
          <TabsContent value="nfl">NFL content</TabsContent>
          <TabsContent value="ncaaf">NCAAF content</TabsContent>
          <TabsContent value="ncaab">NCAAB content</TabsContent>
          <TabsContent value="mlb">MLB content</TabsContent>
        </>
      )}
    </Tabs>
  );
}


import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FootballIcon, BaseballIcon, BasketballIcon } from "./SportIcons";

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
          <FootballIcon className="w-4 h-4" />
          <span className="hidden sm:inline">NFL</span>
        </TabsTrigger>
        <TabsTrigger value="ncaaf" className="flex items-center gap-2">
          <FootballIcon className="w-4 h-4" />
          <span className="hidden sm:inline">NCAAF</span>
        </TabsTrigger>
        <TabsTrigger value="ncaab" className="flex items-center gap-2">
          <BasketballIcon className="w-4 h-4" />
          <span className="hidden sm:inline">NCAAB</span>
        </TabsTrigger>
        <TabsTrigger value="mlb" className="flex items-center gap-2">
          <BaseballIcon className="w-4 h-4" />
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


import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FaFootballBall, FaBasketballBall, FaBaseballBall } from "react-icons/fa";
import { IconContext } from "react-icons";
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

  const getIconColor = (sport: string) => {
    return activeTab === sport ? `text-edge-${sport}` : "";
  }

  return (
    <IconContext.Provider value={{ size: '1rem', className: 'inline-block' }}>
      <Tabs defaultValue={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="nfl" className="flex items-center gap-2">
            <FaFootballBall className={cn("w-4 h-4", getIconColor("nfl"))} />
            <span className="hidden sm:inline">NFL</span>
          </TabsTrigger>
          <TabsTrigger value="ncaaf" className="flex items-center gap-2">
            <FaFootballBall className={cn("w-4 h-4", getIconColor("ncaaf"))} />
            <span className="hidden sm:inline">NCAAF</span>
          </TabsTrigger>
          <TabsTrigger value="ncaab" className="flex items-center gap-2">
            <FaBasketballBall className={cn("w-4 h-4", getIconColor("ncaab"))} />
            <span className="hidden sm:inline">NCAAB</span>
          </TabsTrigger>
          <TabsTrigger value="mlb" className="flex items-center gap-2">
            <FaBaseballBall className={cn("w-4 h-4", getIconColor("mlb"))} />
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
    </IconContext.Provider>
  );
}

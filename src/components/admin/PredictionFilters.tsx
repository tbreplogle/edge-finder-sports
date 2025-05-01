
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, RefreshCw } from "lucide-react";

export interface FilterValues {
  sport: string;
  dateSince: string;
}

interface PredictionFiltersProps {
  filters: FilterValues;
  onFilterChange: (key: keyof FilterValues, value: string) => void; 
  onApplyFilters: () => void;
  isLoading: boolean;
}

export function PredictionFilters({ 
  filters, 
  onFilterChange, 
  onApplyFilters, 
  isLoading 
}: PredictionFiltersProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted-foreground">Sport</label>
            <Select
              value={filters.sport}
              onValueChange={(value) => onFilterChange('sport', value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select sport" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sports</SelectItem>
                <SelectItem value="nfl">NFL</SelectItem>
                <SelectItem value="ncaaf">NCAAF</SelectItem>
                <SelectItem value="ncaab">NCAAB</SelectItem>
                <SelectItem value="mlb">MLB</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted-foreground">Date Range</label>
            <Select
              value={filters.dateSince}
              onValueChange={(value) => onFilterChange('dateSince', value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Since Yesterday</SelectItem>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            className="mt-auto"
            onClick={onApplyFilters}
            disabled={isLoading}
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Filter className="h-4 w-4 mr-2" />
            )}
            Apply Filters
          </Button>
          
          <Button 
            variant="outline"
            className="mt-auto"
            onClick={onApplyFilters}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

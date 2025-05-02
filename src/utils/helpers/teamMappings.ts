
// Helper to map MLB team names to their database IDs, abbreviations and proper names

export interface TeamMapping {
  team_id: number;
  team_abbr: string;
  actual_team_name: string;
}

// Complete mapping of team names to IDs, abbreviations, and proper names
export const mlbTeamMappings: Record<string, TeamMapping> = {
  // Ordered by team_id as shown in the image
  'Seattle Mariners': { team_id: 1, team_abbr: 'SEA', actual_team_name: 'Seattle Mariners' },
  'Cleveland Guardians': { team_id: 2, team_abbr: 'CLE', actual_team_name: 'Cleveland Guardians' },
  'Pittsburgh Pirates': { team_id: 3, team_abbr: 'PIT', actual_team_name: 'Pittsburgh Pirates' },
  'Los Angeles Angels': { team_id: 4, team_abbr: 'LAA', actual_team_name: 'Los Angeles Angels' },
  'Toronto Blue Jays': { team_id: 5, team_abbr: 'TOR', actual_team_name: 'Toronto Blue Jays' },
  'Miami Marlins': { team_id: 6, team_abbr: 'MIA', actual_team_name: 'Miami Marlins' },
  'Oakland Athletics': { team_id: 7, team_abbr: 'OAK', actual_team_name: 'Oakland Athletics' },
  'New York Yankees': { team_id: 8, team_abbr: 'NYY', actual_team_name: 'New York Yankees' },
  'Tampa Bay Rays': { team_id: 9, team_abbr: 'TBR', actual_team_name: 'Tampa Bay Rays' },
  'Minnesota Twins': { team_id: 10, team_abbr: 'MIN', actual_team_name: 'Minnesota Twins' },
  'Kansas City Royals': { team_id: 11, team_abbr: 'KCR', actual_team_name: 'Kansas City Royals' },
  'San Francisco Giants': { team_id: 12, team_abbr: 'SFG', actual_team_name: 'San Francisco Giants' },
  'Arizona Diamondbacks': { team_id: 13, team_abbr: 'ARI', actual_team_name: 'Arizona Diamondbacks' },
  'Milwaukee Brewers': { team_id: 14, team_abbr: 'MIL', actual_team_name: 'Milwaukee Brewers' },
  'Chicago White Sox': { team_id: 15, team_abbr: 'CWS', actual_team_name: 'Chicago White Sox' },
  'Chicago Cubs': { team_id: 16, team_abbr: 'CHC', actual_team_name: 'Chicago Cubs' },
  'Atlanta Braves': { team_id: 17, team_abbr: 'ATL', actual_team_name: 'Atlanta Braves' },
  'San Diego Padres': { team_id: 18, team_abbr: 'SDP', actual_team_name: 'San Diego Padres' },
  'Houston Astros': { team_id: 19, team_abbr: 'HOU', actual_team_name: 'Houston Astros' },
  'New York Mets': { team_id: 20, team_abbr: 'NYM', actual_team_name: 'New York Mets' },
  'Los Angeles Dodgers': { team_id: 21, team_abbr: 'LAD', actual_team_name: 'Los Angeles Dodgers' },
  'Colorado Rockies': { team_id: 22, team_abbr: 'COL', actual_team_name: 'Colorado Rockies' },
  'Cincinnati Reds': { team_id: 23, team_abbr: 'CIN', actual_team_name: 'Cincinnati Reds' },
  'Washington Nationals': { team_id: 24, team_abbr: 'WSH', actual_team_name: 'Washington Nationals' },
  'Detroit Tigers': { team_id: 25, team_abbr: 'DET', actual_team_name: 'Detroit Tigers' },
  'Philadelphia Phillies': { team_id: 26, team_abbr: 'PHI', actual_team_name: 'Philadelphia Phillies' },
  'St. Louis Cardinals': { team_id: 27, team_abbr: 'STL', actual_team_name: 'St. Louis Cardinals' },
  'Texas Rangers': { team_id: 28, team_abbr: 'TEX', actual_team_name: 'Texas Rangers' },
  'Boston Red Sox': { team_id: 29, team_abbr: 'BOS', actual_team_name: 'Boston Red Sox' },
  'Baltimore Orioles': { team_id: 30, team_abbr: 'BAL', actual_team_name: 'Baltimore Orioles' },
};

// Helper function to find team information by name (with fuzzy matching)
export function getTeamMappingByName(teamName: string): TeamMapping | undefined {
  // Direct lookup first
  if (mlbTeamMappings[teamName]) {
    return mlbTeamMappings[teamName];
  }
  
  // Special case for Athletics with duplicate name (case-insensitive)
  if (teamName.toUpperCase().includes('ATHLETICS') || teamName.includes('Oakland')) {
    return mlbTeamMappings['Oakland Athletics'];
  }
  
  // Try partial matching
  for (const [key, value] of Object.entries(mlbTeamMappings)) {
    if (teamName.includes(key) || key.includes(teamName)) {
      return value;
    }
  }
  
  // No match found
  return undefined;
}

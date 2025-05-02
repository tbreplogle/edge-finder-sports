
// Helper to get abbreviations for team names
export function getTeamAbbreviation(teamName: string): string {
  // Complete mapping of team names to abbreviations
  const teamMap: Record<string, string> = {
    // MLB
    'Arizona Diamondbacks': 'ARI',
    'Atlanta Braves': 'ATL',
    'Baltimore Orioles': 'BAL',
    'Boston Red Sox': 'BOS',
    'Chicago Cubs': 'CHC',
    'Chicago White Sox': 'CWS',
    'Cincinnati Reds': 'CIN',
    'Cleveland Guardians': 'CLE',
    'Colorado Rockies': 'COL',
    'Detroit Tigers': 'DET',
    'Houston Astros': 'HOU',
    'Kansas City Royals': 'KC',
    'Los Angeles Angels': 'LAA',
    'Los Angeles Dodgers': 'LAD',
    'Miami Marlins': 'MIA',
    'Milwaukee Brewers': 'MIL',
    'Minnesota Twins': 'MIN',
    'New York Mets': 'NYM',
    'New York Yankees': 'NYY',
    'Oakland Athletics': 'ATH',
    'Philadelphia Phillies': 'PHI',
    'Pittsburgh Pirates': 'PIT',
    'San Diego Padres': 'SD',
    'San Francisco Giants': 'SF',
    'Seattle Mariners': 'SEA',
    'St. Louis Cardinals': 'STL',
    'Tampa Bay Rays': 'TB',
    'Texas Rangers': 'TEX',
    'Toronto Blue Jays': 'TOR',
    'Washington Nationals': 'WSH',
    
    // Special case for the duplicate name "ATHLETICATHLETIC"
    'ATHLETICATHLETIC': 'ATH',
    
    // NFL
    'Kansas City Chiefs': 'KC',
    'San Francisco 49ers': 'SF',
    'Dallas Cowboys': 'DAL',
    'Buffalo Bills': 'BUF',
    'Philadelphia Eagles': 'PHI',
    'Baltimore Ravens': 'BAL',
    
    // NCAAF
    'Georgia Bulldogs': 'UGA',
    'Michigan Wolverines': 'MICH',
    'Alabama Crimson Tide': 'BAMA',
    'Ohio State Buckeyes': 'OSU',
    
    // NCAAB
    'Gonzaga Bulldogs': 'GON',
    'Kansas Jayhawks': 'KAN',
    'Baylor Bears': 'BAY',
    'Duke Blue Devils': 'DUKE',
  };
  
  // Check for specific edge case first
  if (teamName.includes('ATHLETIC')) {
    return 'ATH';
  }
  
  return teamMap[teamName] || teamName.split(' ').pop()?.substring(0, 3).toUpperCase() || teamName.substring(0, 3).toUpperCase();
}

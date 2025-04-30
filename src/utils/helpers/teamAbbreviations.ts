
// Helper to get abbreviations for team names
export function getTeamAbbreviation(teamName: string): string {
  // This is a simplified version - in a real app, you'd have a complete mapping
  const teamMap: Record<string, string> = {
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
    
    // MLB
    'New York Yankees': 'NYY',
    'Los Angeles Dodgers': 'LAD',
    'Boston Red Sox': 'BOS',
    'Chicago Cubs': 'CHC',
    'Houston Astros': 'HOU',
    
    // Add more mappings as needed
  };
  
  return teamMap[teamName] || teamName.split(' ').pop()?.substring(0, 3).toUpperCase() || teamName.substring(0, 3).toUpperCase();
}

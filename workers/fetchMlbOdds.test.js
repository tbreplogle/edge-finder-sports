
import { jest } from '@jest/globals';
import axios from 'axios';
import * as fetchMlbOddsModule from './fetchMlbOdds.js';

// Mock external dependencies
jest.mock('axios');
jest.mock('./lib/supabaseClient.js', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: [], error: null })
    }))
  },
  testConnection: jest.fn().mockResolvedValue(true),
  createScrapeReport: jest.fn()
}));

// Mock the teamMappings module
jest.mock('../src/utils/helpers/teamMappings.js', () => ({
  getTeamMappingByName: (name) => {
    const mockMappings = {
      'New York Yankees': { team_id: 8, team_abbr: 'NYY', actual_team_name: 'New York Yankees' },
      'Boston Red Sox': { team_id: 29, team_abbr: 'BOS', actual_team_name: 'Boston Red Sox' },
      'Chicago Cubs': { team_id: 16, team_abbr: 'CHC', actual_team_name: 'Chicago Cubs' },
      'Chicago White Sox': { team_id: 15, team_abbr: 'CWS', actual_team_name: 'Chicago White Sox' }
    };
    return mockMappings[name];
  },
  mlbTeamMappings: {}
}));

describe('fetchMlbOdds', () => {
  // Sample API response
  const mockApiResponse = {
    data: [
      {
        id: 'game_1',
        sport_key: 'baseball_mlb',
        sport_title: 'MLB',
        commence_time: '2025-05-10T18:05:00Z',
        home_team: 'New York Yankees',
        away_team: 'Boston Red Sox',
        bookmakers: [
          {
            key: 'draftkings',
            title: 'DraftKings',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'New York Yankees', price: -150 },
                  { name: 'Boston Red Sox', price: +130 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'game_2',
        sport_key: 'baseball_mlb',
        sport_title: 'MLB',
        commence_time: '2025-05-10T20:10:00Z',
        home_team: 'Chicago Cubs',
        away_team: 'Chicago White Sox',
        bookmakers: [
          {
            key: 'fanduel',
            title: 'FanDuel',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Chicago Cubs', price: -120 },
                  { name: 'Chicago White Sox', price: +110 }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetchMlbOdds should retrieve and return odds data', async () => {
    axios.get.mockResolvedValueOnce(mockApiResponse);
    
    const result = await fetchMlbOddsModule.fetchMlbOdds();
    
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.the-odds-api.com/v4/sports/baseball_mlb/odds',
      expect.objectContaining({
        params: expect.objectContaining({
          apiKey: expect.any(String),
          regions: 'us',
          markets: 'h2h',
          oddsFormat: 'american'
        })
      })
    );
    
    expect(result).toEqual(mockApiResponse.data);
  });

  test('mapTeamIds should correctly map team names to IDs and extract odds', () => {
    const game = mockApiResponse.data[0];
    const { mapTeamIds } = fetchMlbOddsModule;
    
    // We'll need to expose this function for testing
    // For this test, we'll assume it's exposed
    
    const result = mapTeamIds(game);
    
    expect(result).toEqual({
      game_id: 'game_1',
      game_date: '2025-05-10',
      game_time_utc: '2025-05-10T18:05:00Z',
      home_team_id: 8,
      away_team_id: 29,
      home_ml: -150,
      away_ml: 130
    });
  });

  test('fetchAndSyncMlbOdds should process the entire pipeline successfully', async () => {
    // Mock all the necessary functions
    axios.get.mockResolvedValueOnce(mockApiResponse);
    
    const mockSupabase = require('./lib/supabaseClient.js').supabase;
    
    // Mock matchups data
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'mlb_matchups') {
        return {
          select: jest.fn().mockResolvedValue({
            data: [
              {
                matchup_id: 'matchup_1',
                home_team_id: 8,
                away_team_id: 29,
                game_date: '2025-05-10'
              },
              {
                matchup_id: 'matchup_2',
                home_team_id: 16,
                away_team_id: 15,
                game_date: '2025-05-10'
              }
            ],
            error: null
          })
        };
      }
      
      // Default mock for other tables
      return {
        select: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockResolvedValue({
          data: [
            { game_id: 'game_1', matchup_id: 'matchup_1' },
            { game_id: 'game_2', matchup_id: 'matchup_2' }
          ],
          error: null
        }),
        insert: jest.fn().mockResolvedValue({ data: [], error: null })
      };
    });
    
    const result = await fetchMlbOddsModule.fetchAndSyncMlbOdds();
    
    expect(result).toEqual({
      success: true,
      stats: expect.objectContaining({
        total_fetched: 2,
        total_mapped: expect.any(Number),
        total_upserted: expect.any(Number)
      })
    });
  });
});

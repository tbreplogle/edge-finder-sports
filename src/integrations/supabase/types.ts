export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      mlb_matchup_details: {
        Row: {
          away_pitcher: string | null
          away_team: string
          bullpen_away_avg: number | null
          bullpen_away_bb: number | null
          bullpen_away_era: number | null
          bullpen_away_hr: number | null
          bullpen_away_ip: number | null
          bullpen_away_k: number | null
          bullpen_away_obp: number | null
          bullpen_away_whip: number | null
          bullpen_home_avg: number | null
          bullpen_home_bb: number | null
          bullpen_home_era: number | null
          bullpen_home_hr: number | null
          bullpen_home_ip: number | null
          bullpen_home_k: number | null
          bullpen_home_obp: number | null
          bullpen_home_whip: number | null
          created_at: string
          game_date: string
          home_pitcher: string | null
          home_team: string
          id: string
          matchup_id: string
        }
        Insert: {
          away_pitcher?: string | null
          away_team: string
          bullpen_away_avg?: number | null
          bullpen_away_bb?: number | null
          bullpen_away_era?: number | null
          bullpen_away_hr?: number | null
          bullpen_away_ip?: number | null
          bullpen_away_k?: number | null
          bullpen_away_obp?: number | null
          bullpen_away_whip?: number | null
          bullpen_home_avg?: number | null
          bullpen_home_bb?: number | null
          bullpen_home_era?: number | null
          bullpen_home_hr?: number | null
          bullpen_home_ip?: number | null
          bullpen_home_k?: number | null
          bullpen_home_obp?: number | null
          bullpen_home_whip?: number | null
          created_at?: string
          game_date: string
          home_pitcher?: string | null
          home_team: string
          id?: string
          matchup_id: string
        }
        Update: {
          away_pitcher?: string | null
          away_team?: string
          bullpen_away_avg?: number | null
          bullpen_away_bb?: number | null
          bullpen_away_era?: number | null
          bullpen_away_hr?: number | null
          bullpen_away_ip?: number | null
          bullpen_away_k?: number | null
          bullpen_away_obp?: number | null
          bullpen_away_whip?: number | null
          bullpen_home_avg?: number | null
          bullpen_home_bb?: number | null
          bullpen_home_era?: number | null
          bullpen_home_hr?: number | null
          bullpen_home_ip?: number | null
          bullpen_home_k?: number | null
          bullpen_home_obp?: number | null
          bullpen_home_whip?: number | null
          created_at?: string
          game_date?: string
          home_pitcher?: string | null
          home_team?: string
          id?: string
          matchup_id?: string
        }
        Relationships: []
      }
      mlb_matchups: {
        Row: {
          away_team: string | null
          created_at: string | null
          game_date: string | null
          game_id: string
          home_team: string | null
        }
        Insert: {
          away_team?: string | null
          created_at?: string | null
          game_date?: string | null
          game_id: string
          home_team?: string | null
        }
        Update: {
          away_team?: string | null
          created_at?: string | null
          game_date?: string | null
          game_id?: string
          home_team?: string | null
        }
        Relationships: []
      }
      mlb_team_hitting_stats: {
        Row: {
          at_bats: number | null
          avg: number | null
          bb: number | null
          created_at: string | null
          cs: number | null
          doubles: number | null
          game_date: string
          games_played: number | null
          hits: number | null
          home_runs: number | null
          id: string
          league: string | null
          obp: number | null
          ops: number | null
          rbi: number | null
          runs: number | null
          sb: number | null
          slg: number | null
          so: number | null
          team_name: string
          timeframe_days: number
          triples: number | null
        }
        Insert: {
          at_bats?: number | null
          avg?: number | null
          bb?: number | null
          created_at?: string | null
          cs?: number | null
          doubles?: number | null
          game_date: string
          games_played?: number | null
          hits?: number | null
          home_runs?: number | null
          id?: string
          league?: string | null
          obp?: number | null
          ops?: number | null
          rbi?: number | null
          runs?: number | null
          sb?: number | null
          slg?: number | null
          so?: number | null
          team_name: string
          timeframe_days: number
          triples?: number | null
        }
        Update: {
          at_bats?: number | null
          avg?: number | null
          bb?: number | null
          created_at?: string | null
          cs?: number | null
          doubles?: number | null
          game_date?: string
          games_played?: number | null
          hits?: number | null
          home_runs?: number | null
          id?: string
          league?: string | null
          obp?: number | null
          ops?: number | null
          rbi?: number | null
          runs?: number | null
          sb?: number | null
          slg?: number | null
          so?: number | null
          team_name?: string
          timeframe_days?: number
          triples?: number | null
        }
        Relationships: []
      }
      pitcher_stats: {
        Row: {
          era_plus: number | null
          game_id: string
          side: string
          team_abbr: string | null
          whip: number | null
        }
        Insert: {
          era_plus?: number | null
          game_id: string
          side: string
          team_abbr?: string | null
          whip?: number | null
        }
        Update: {
          era_plus?: number | null
          game_id?: string
          side?: string
          team_abbr?: string | null
          whip?: number | null
        }
        Relationships: []
      }
      predictions: {
        Row: {
          away_ml: number | null
          away_team: string
          confidence_pct: number | null
          created_at: string
          edge: number | null
          game_date: string
          game_id: string
          home_ml: number | null
          home_team: string
          id: number
          market_away_ml: number | null
          market_home_ml: number | null
          predicted_margin: number | null
          predicted_total: number | null
          sport: string
          updated_at: string
        }
        Insert: {
          away_ml?: number | null
          away_team: string
          confidence_pct?: number | null
          created_at?: string
          edge?: number | null
          game_date: string
          game_id: string
          home_ml?: number | null
          home_team: string
          id?: number
          market_away_ml?: number | null
          market_home_ml?: number | null
          predicted_margin?: number | null
          predicted_total?: number | null
          sport: string
          updated_at?: string
        }
        Update: {
          away_ml?: number | null
          away_team?: string
          confidence_pct?: number | null
          created_at?: string
          edge?: number | null
          game_date?: string
          game_id?: string
          home_ml?: number | null
          home_team?: string
          id?: number
          market_away_ml?: number | null
          market_home_ml?: number | null
          predicted_margin?: number | null
          predicted_total?: number | null
          sport?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_stats: {
        Row: {
          ba: number | null
          hr: number | null
          hra: number | null
          team_abbr: string
          updated_at: string | null
        }
        Insert: {
          ba?: number | null
          hr?: number | null
          hra?: number | null
          team_abbr: string
          updated_at?: string | null
        }
        Update: {
          ba?: number | null
          hr?: number | null
          hra?: number | null
          team_abbr?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_mlb_team_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

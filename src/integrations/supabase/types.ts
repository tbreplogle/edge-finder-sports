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
      mlb_matchups: {
        Row: {
          away_team: string
          away_team_id: number | null
          created_at: string
          game_date: string
          game_id: string
          home_team: string
          home_team_id: number | null
          matchup_id: string
        }
        Insert: {
          away_team: string
          away_team_id?: number | null
          created_at?: string
          game_date: string
          game_id: string
          home_team: string
          home_team_id?: number | null
          matchup_id: string
        }
        Update: {
          away_team?: string
          away_team_id?: number | null
          created_at?: string
          game_date?: string
          game_id?: string
          home_team?: string
          home_team_id?: number | null
          matchup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_away_team"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams_mlb"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "fk_home_team"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams_mlb"
            referencedColumns: ["team_id"]
          },
        ]
      }
      mlb_team_hitting_stats: {
        Row: {
          actual_team_name: string | null
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
          team_abbr: string | null
          team_id: number | null
          team_name: string
          timeframe_days: number
          triples: number | null
        }
        Insert: {
          actual_team_name?: string | null
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
          team_abbr?: string | null
          team_id?: number | null
          team_name: string
          timeframe_days: number
          triples?: number | null
        }
        Update: {
          actual_team_name?: string | null
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
          team_abbr?: string | null
          team_id?: number | null
          team_name?: string
          timeframe_days?: number
          triples?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_mlb_stats_team"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_mlb"
            referencedColumns: ["team_id"]
          },
        ]
      }
      pitching_matchups: {
        Row: {
          away_bb: number | null
          away_er: number | null
          away_gb_fb: number | null
          away_h: number | null
          away_hr: number | null
          away_ip: number | null
          away_p_per_ip: number | null
          away_pit: number | null
          away_pitcher_name: string | null
          away_r: number | null
          away_so: number | null
          created_at: string | null
          home_bb: number | null
          home_er: number | null
          home_gb_fb: number | null
          home_h: number | null
          home_hr: number | null
          home_ip: number | null
          home_p_per_ip: number | null
          home_pit: number | null
          home_pitcher_name: string | null
          home_r: number | null
          home_so: number | null
          matchup_id: string
        }
        Insert: {
          away_bb?: number | null
          away_er?: number | null
          away_gb_fb?: number | null
          away_h?: number | null
          away_hr?: number | null
          away_ip?: number | null
          away_p_per_ip?: number | null
          away_pit?: number | null
          away_pitcher_name?: string | null
          away_r?: number | null
          away_so?: number | null
          created_at?: string | null
          home_bb?: number | null
          home_er?: number | null
          home_gb_fb?: number | null
          home_h?: number | null
          home_hr?: number | null
          home_ip?: number | null
          home_p_per_ip?: number | null
          home_pit?: number | null
          home_pitcher_name?: string | null
          home_r?: number | null
          home_so?: number | null
          matchup_id: string
        }
        Update: {
          away_bb?: number | null
          away_er?: number | null
          away_gb_fb?: number | null
          away_h?: number | null
          away_hr?: number | null
          away_ip?: number | null
          away_p_per_ip?: number | null
          away_pit?: number | null
          away_pitcher_name?: string | null
          away_r?: number | null
          away_so?: number | null
          created_at?: string | null
          home_bb?: number | null
          home_er?: number | null
          home_gb_fb?: number | null
          home_h?: number | null
          home_hr?: number | null
          home_ip?: number | null
          home_p_per_ip?: number | null
          home_pit?: number | null
          home_pitcher_name?: string | null
          home_r?: number | null
          home_so?: number | null
          matchup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitching_matchups_matchup_id_fkey"
            columns: ["matchup_id"]
            isOneToOne: true
            referencedRelation: "mlb_matchups"
            referencedColumns: ["matchup_id"]
          },
        ]
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
      teams_mlb: {
        Row: {
          actual_team_name: string
          alt_name: string | null
          team_abbr: string
          team_id: number
        }
        Insert: {
          actual_team_name: string
          alt_name?: string | null
          team_abbr: string
          team_id?: number
        }
        Update: {
          actual_team_name?: string
          alt_name?: string | null
          team_abbr?: string
          team_id?: number
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

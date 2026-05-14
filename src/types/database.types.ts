export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** Replace with `supabase gen types typescript --linked` output when your project is live. */
export interface Database {
  public: {
    Tables: {
      songs: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          artist: string;
          album: string;
          release_year: number | null;
          audio_storage_path: string;
          artwork_storage_path: string | null;
          duration_seconds: number | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          artist?: string;
          album?: string;
          release_year?: number | null;
          audio_storage_path: string;
          artwork_storage_path?: string | null;
          duration_seconds?: number | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          artist?: string;
          album?: string;
          release_year?: number | null;
          audio_storage_path?: string;
          artwork_storage_path?: string | null;
          duration_seconds?: number | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

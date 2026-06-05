export type ActivityCategory = 'food' | 'sightseeing' | 'activity' | 'transit' | 'rest';

export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
}

export interface Trip {
  id: string;
  user_id: string;
  title: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  trip_id: string;
  day_number: number;
  title: string;
  location: string | null;
  start_time: string | null;
  category: ActivityCategory;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: { id: string; display_name?: string | null; created_at?: string };
        Update: { display_name?: string | null };
      };
      trips: {
        Row: Trip;
        Insert: {
          id?: string;
          user_id?: string;
          title?: string;
          destination?: string;
          start_date?: string | null;
          end_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          destination?: string;
          start_date?: string | null;
          end_date?: string | null;
          notes?: string | null;
        };
      };
      activities: {
        Row: Activity;
        Insert: {
          id?: string;
          trip_id: string;
          day_number: number;
          title: string;
          location?: string | null;
          start_time?: string | null;
          category: ActivityCategory;
          notes?: string | null;
          sort_order: number;
          created_at?: string;
        };
        Update: {
          day_number?: number;
          title?: string;
          location?: string | null;
          start_time?: string | null;
          category?: ActivityCategory;
          notes?: string | null;
          sort_order?: number;
        };
      };
    };
    Enums: {
      activity_category: ActivityCategory;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'user' | 'moderator' | 'admin';
export type PostStatus = 'pending' | 'approved' | 'rejected' | 'archived';
export type ModerationAction = 'approved' | 'rejected' | 'escalated' | 'dismissed';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          role: UserRole
          is_suspended: boolean
          suspension_reason: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          role?: UserRole
          is_suspended?: boolean
          suspension_reason?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          username?: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          role?: UserRole
          is_suspended?: boolean
          suspension_reason?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          id: string
          author_id: string
          title: string
          body: string
          media_urls: string[]
          image_url: string | null
          status: PostStatus
          rejection_reason: string | null
          is_nsfw: boolean
          is_pinned: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
          published_at: string | null
        }
        Insert: {
          id?: string
          author_id: string
          title: string
          body: string
          media_urls?: string[]
          image_url?: string | null
          status?: PostStatus
          rejection_reason?: string | null
          is_nsfw?: boolean
          is_pinned?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
          published_at?: string | null
        }
        Update: {
          id?: string
          author_id?: string
          title?: string
          body?: string
          media_urls?: string[]
          image_url?: string | null
          status?: PostStatus
          rejection_reason?: string | null
          is_nsfw?: boolean
          is_pinned?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
          published_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      achievements: {
        Row: {
          id: string
          profile_id: string
          badge_type: string
          title: string
          description: string
          earned_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          badge_type: string
          title: string
          description: string
          earned_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          badge_type?: string
          title?: string
          description?: string
          earned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          id?: string
          follower_id?: string
          following_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      admin_whitelist: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          user_id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          role: UserRole
          is_suspended: boolean
          suspension_reason: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
      }
      get_follower_count: {
        Args: {
          profile_id: string
        }
        Returns: number
      }
      get_following_count: {
        Args: {
          profile_id: string
        }
        Returns: number
      }
      toggle_follow: {
        Args: {
          follower_id_param: string
          following_id_param: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      post_status: PostStatus
      user_role: UserRole
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  moderation: {
    Tables: {
      moderation_queue: {
        Row: {
          id: string
          post_id: string
          assigned_to: string | null
          reviewed_by: string | null
          action: ModerationAction | null
          action_note: string | null
          ml_risk_score: number | null
          is_escalated: boolean
          queued_at: string
          reviewed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          post_id: string
          assigned_to?: string | null
          reviewed_by?: string | null
          action?: ModerationAction | null
          action_note?: string | null
          ml_risk_score?: number | null
          is_escalated?: boolean
          queued_at?: string
          reviewed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          assigned_to?: string | null
          reviewed_by?: string | null
          action?: ModerationAction | null
          action_note?: string | null
          ml_risk_score?: number | null
          is_escalated?: boolean
          queued_at?: string
          reviewed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_queue_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_queue_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_queue_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      action_type: ModerationAction
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

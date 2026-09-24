export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_claim_attempts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_agents: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          custom_tone_text: string | null
          description: string | null
          id: string
          is_default: boolean
          max_tokens: number
          model: string
          name: string
          slug: string
          system_prompt: string
          temperature: number
          tone: Database["public"]["Enums"]["ai_tone"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          custom_tone_text?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          max_tokens?: number
          model?: string
          name: string
          slug: string
          system_prompt?: string
          temperature?: number
          tone?: Database["public"]["Enums"]["ai_tone"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          custom_tone_text?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          max_tokens?: number
          model?: string
          name?: string
          slug?: string
          system_prompt?: string
          temperature?: number
          tone?: Database["public"]["Enums"]["ai_tone"]
          updated_at?: string
        }
        Relationships: []
      }
      ai_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      ai_capabilities: {
        Row: {
          agent_id: string
          capability_key: string
          config: Json
          created_at: string
          enabled: boolean
          id: string
        }
        Insert: {
          agent_id: string
          capability_key: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
        }
        Update: {
          agent_id?: string
          capability_key?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_capabilities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feature_toggles: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          enabled: boolean
          feature_key: string
          id: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          feature_key: string
          id?: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          feature_key?: string
          id?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_prompt_templates: {
        Row: {
          active: boolean
          body: string
          category: string
          created_at: string
          created_by: string | null
          current_version: number
          id: string
          name: string
          slug: string
          updated_at: string
          variables: Json
        }
        Insert: {
          active?: boolean
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          id?: string
          name: string
          slug: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          active?: boolean
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          id?: string
          name?: string
          slug?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      ai_prompt_versions: {
        Row: {
          body: string
          changelog: string | null
          created_at: string
          created_by: string | null
          id: string
          published: boolean
          template_id: string
          variables: Json
          version_no: number
        }
        Insert: {
          body: string
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          template_id: string
          variables?: Json
          version_no: number
        }
        Update: {
          body?: string
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          template_id?: string
          variables?: Json
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_story_history: {
        Row: {
          age_band: string | null
          audio_url: string | null
          character_visual_hash: string | null
          child_profile_id: string | null
          created_at: string
          generated_story: Json
          id: string
          language: string
          pages: Json
          pdf_url: string | null
          prompt_data: Json
          quality_scores: Json
          quality_total: number | null
          regeneration_count: number
          safety_passed: boolean
          sel_analysis: Json
          sel_outcome: Json
          theme: string | null
          title: string | null
          updated_at: string
          user_id: string
          video_embed_url: string | null
          visibility: string
        }
        Insert: {
          age_band?: string | null
          audio_url?: string | null
          character_visual_hash?: string | null
          child_profile_id?: string | null
          created_at?: string
          generated_story?: Json
          id?: string
          language?: string
          pages?: Json
          pdf_url?: string | null
          prompt_data?: Json
          quality_scores?: Json
          quality_total?: number | null
          regeneration_count?: number
          safety_passed?: boolean
          sel_analysis?: Json
          sel_outcome?: Json
          theme?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          video_embed_url?: string | null
          visibility?: string
        }
        Update: {
          age_band?: string | null
          audio_url?: string | null
          character_visual_hash?: string | null
          child_profile_id?: string | null
          created_at?: string
          generated_story?: Json
          id?: string
          language?: string
          pages?: Json
          pdf_url?: string | null
          prompt_data?: Json
          quality_scores?: Json
          quality_total?: number | null
          regeneration_count?: number
          safety_passed?: boolean
          sel_analysis?: Json
          sel_outcome?: Json
          theme?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          video_embed_url?: string | null
          visibility?: string
        }
        Relationships: []
      }
      ai_usage_costs: {
        Row: {
          created_at: string | null
          estimated_cost: number | null
          event_type: string
          id: string
          metadata: Json | null
          provider: string
          units: number
        }
        Insert: {
          created_at?: string | null
          estimated_cost?: number | null
          event_type: string
          id?: string
          metadata?: Json | null
          provider: string
          units?: number
        }
        Update: {
          created_at?: string | null
          estimated_cost?: number | null
          event_type?: string
          id?: string
          metadata?: Json | null
          provider?: string
          units?: number
        }
        Relationships: []
      }
      ai_usage_limits: {
        Row: {
          created_at: string
          daily_limit: number | null
          feature_key: string | null
          id: string
          monthly_limit: number | null
          notes: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          scope: Database["public"]["Enums"]["ai_limit_scope"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          daily_limit?: number | null
          feature_key?: string | null
          id?: string
          monthly_limit?: number | null
          notes?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          scope?: Database["public"]["Enums"]["ai_limit_scope"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          daily_limit?: number | null
          feature_key?: string | null
          id?: string
          monthly_limit?: number | null
          notes?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          scope?: Database["public"]["Enums"]["ai_limit_scope"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          agent_id: string | null
          cost_usd: number | null
          created_at: string
          error: string | null
          feature_key: string
          id: string
          latency_ms: number | null
          metadata: Json
          model: string | null
          status: Database["public"]["Enums"]["ai_usage_status"]
          tokens_in: number | null
          tokens_out: number | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          feature_key: string
          id?: string
          latency_ms?: number | null
          metadata?: Json
          model?: string | null
          status?: Database["public"]["Enums"]["ai_usage_status"]
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          feature_key?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json
          model?: string | null
          status?: Database["public"]["Enums"]["ai_usage_status"]
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          allow_free_registrations: boolean
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_free_registrations?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_free_registrations?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audio_cache: {
        Row: {
          content_hash: string
          created_at: string
          duration_seconds: number | null
          file_path: string
          file_size: number | null
          id: string
          language: string | null
          last_used_at: string
          provider: string
          used_count: number
          voice_id: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          duration_seconds?: number | null
          file_path: string
          file_size?: number | null
          id?: string
          language?: string | null
          last_used_at?: string
          provider: string
          used_count?: number
          voice_id: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          duration_seconds?: number | null
          file_path?: string
          file_size?: number | null
          id?: string
          language?: string | null
          last_used_at?: string
          provider?: string
          used_count?: number
          voice_id?: string
        }
        Relationships: []
      }
      audio_voice_profiles: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          description: string | null
          gender: string | null
          id: string
          is_default: boolean
          language: string | null
          name: string
          provider: string
          sample_url: string | null
          updated_at: string
          voice_id: string
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          is_default?: boolean
          language?: string | null
          name: string
          provider?: string
          sample_url?: string | null
          updated_at?: string
          voice_id: string
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          is_default?: boolean
          language?: string | null
          name?: string
          provider?: string
          sample_url?: string | null
          updated_at?: string
          voice_id?: string
        }
        Relationships: []
      }
      batch_export_jobs: {
        Row: {
          bundle_path: string | null
          bundle_url: string | null
          cancel_requested: boolean
          child_id: string | null
          completed: number
          created_at: string
          error: string | null
          failed_items: Json
          formats: string[]
          id: string
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bundle_path?: string | null
          bundle_url?: string | null
          cancel_requested?: boolean
          child_id?: string | null
          completed?: number
          created_at?: string
          error?: string | null
          failed_items?: Json
          formats?: string[]
          id?: string
          status?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bundle_path?: string | null
          bundle_url?: string | null
          cancel_requested?: boolean
          child_id?: string | null
          completed?: number
          created_at?: string
          error?: string | null
          failed_items?: Json
          formats?: string[]
          id?: string
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bedtime_schedules: {
        Row: {
          child_profile_id: string
          created_at: string
          dark_mode: boolean
          day_of_week: number
          end_time: string
          id: string
          parent_user_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          child_profile_id: string
          created_at?: string
          dark_mode?: boolean
          day_of_week: number
          end_time: string
          id?: string
          parent_user_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          child_profile_id?: string
          created_at?: string
          dark_mode?: boolean
          day_of_week?: number
          end_time?: string
          id?: string
          parent_user_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bedtime_schedules_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_categories: {
        Row: {
          created_at: string
          description: Json
          id: string
          name: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: Json
          id?: string
          name?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: Json
          id?: string
          name?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string | null
          category_id: string | null
          content: Json
          cover_image: string | null
          created_at: string
          created_by: string | null
          excerpt: Json
          id: string
          published: boolean
          published_at: string | null
          reading_minutes: number | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seo_description: Json
          seo_title: Json
          slug: string
          submission_status: string
          tags: string[] | null
          title: Json
          updated_at: string
          views: number
        }
        Insert: {
          author_name?: string | null
          category_id?: string | null
          content?: Json
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: Json
          id?: string
          published?: boolean
          published_at?: string | null
          reading_minutes?: number | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seo_description?: Json
          seo_title?: Json
          slug: string
          submission_status?: string
          tags?: string[] | null
          title?: Json
          updated_at?: string
          views?: number
        }
        Update: {
          author_name?: string | null
          category_id?: string | null
          content?: Json
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: Json
          id?: string
          published?: boolean
          published_at?: string | null
          reading_minutes?: number | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seo_description?: Json
          seo_title?: Json
          slug?: string
          submission_status?: string
          tags?: string[] | null
          title?: Json
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      child_learning_progress: {
        Row: {
          child_id: string
          created_at: string
          id: string
          new_level: string
          previous_level: string
          reason: string | null
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          new_level: string
          previous_level: string
          reason?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          new_level?: string
          previous_level?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_learning_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      child_profiles: {
        Row: {
          age: number | null
          avatar: string | null
          bedtime_preferences: Json
          created_at: string
          emotional_focus: Json
          id: string
          name: string
          parent_user_id: string
          preferred_language: string
          reading_level: string | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          avatar?: string | null
          bedtime_preferences?: Json
          created_at?: string
          emotional_focus?: Json
          id?: string
          name: string
          parent_user_id: string
          preferred_language?: string
          reading_level?: string | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          avatar?: string | null
          bedtime_preferences?: Json
          created_at?: string
          emotional_focus?: Json
          id?: string
          name?: string
          parent_user_id?: string
          preferred_language?: string
          reading_level?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          language: string | null
          message: string
          name: string
          status: string
          subject: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          language?: string | null
          message: string
          name: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          language?: string | null
          message?: string
          name?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          reference_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      download_audit_log: {
        Row: {
          created_at: string
          format: string
          id: string
          outcome: string
          reason: string | null
          story_id: string | null
          story_title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          format: string
          id?: string
          outcome: string
          reason?: string | null
          story_id?: string | null
          story_title?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          outcome?: string
          reason?: string | null
          story_id?: string | null
          story_title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      download_history: {
        Row: {
          created_at: string
          file_size_bytes: number | null
          format: string
          id: string
          story_id: string | null
          story_title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_size_bytes?: number | null
          format: string
          id?: string
          story_id?: string | null
          story_title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_size_bytes?: number | null
          format?: string
          id?: string
          story_id?: string | null
          story_title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      download_settings: {
        Row: {
          alert_email: string | null
          alerts_email_enabled: boolean
          alerts_slack_enabled: boolean
          created_at: string
          daily_limit_per_user: number
          enable_docx: boolean
          enable_epub: boolean
          enable_images: boolean
          enable_mp3: boolean
          enable_pack: boolean
          enable_pdf: boolean
          enable_txt: boolean
          id: boolean
          last_alert_sent_at: string | null
          last_alert_signature: string | null
          max_file_size_mb: number
          slack_channel_id: string | null
          updated_at: string
        }
        Insert: {
          alert_email?: string | null
          alerts_email_enabled?: boolean
          alerts_slack_enabled?: boolean
          created_at?: string
          daily_limit_per_user?: number
          enable_docx?: boolean
          enable_epub?: boolean
          enable_images?: boolean
          enable_mp3?: boolean
          enable_pack?: boolean
          enable_pdf?: boolean
          enable_txt?: boolean
          id?: boolean
          last_alert_sent_at?: string | null
          last_alert_signature?: string | null
          max_file_size_mb?: number
          slack_channel_id?: string | null
          updated_at?: string
        }
        Update: {
          alert_email?: string | null
          alerts_email_enabled?: boolean
          alerts_slack_enabled?: boolean
          created_at?: string
          daily_limit_per_user?: number
          enable_docx?: boolean
          enable_epub?: boolean
          enable_images?: boolean
          enable_mp3?: boolean
          enable_pack?: boolean
          enable_pdf?: boolean
          enable_txt?: boolean
          id?: boolean
          last_alert_sent_at?: string | null
          last_alert_signature?: string | null
          max_file_size_mb?: number
          slack_channel_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      drawing_entries: {
        Row: {
          approved: boolean
          artist: Json
          created_at: string
          id: string
          image: string | null
          submitted_by: string | null
          title: Json
          updated_at: string
          votes: number
        }
        Insert: {
          approved?: boolean
          artist?: Json
          created_at?: string
          id?: string
          image?: string | null
          submitted_by?: string | null
          title?: Json
          updated_at?: string
          votes?: number
        }
        Update: {
          approved?: boolean
          artist?: Json
          created_at?: string
          id?: string
          image?: string | null
          submitted_by?: string | null
          title?: Json
          updated_at?: string
          votes?: number
        }
        Relationships: []
      }
      drawing_votes: {
        Row: {
          created_at: string
          drawing_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drawing_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          drawing_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawing_votes_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawing_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_log: {
        Row: {
          created_at: string
          error: string | null
          id: string
          payload: Json
          recipient: string
          status: string
          template: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json
          recipient: string
          status?: string
          template: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json
          recipient?: string
          status?: string
          template?: string
        }
        Relationships: []
      }
      export_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          export_id: string | null
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          export_id?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          export_id?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "export_logs_export_id_fkey"
            columns: ["export_id"]
            isOneToOne: false
            referencedRelation: "exports"
            referencedColumns: ["id"]
          },
        ]
      }
      exports: {
        Row: {
          audio_metadata: Json | null
          child_id: string | null
          created_at: string
          dap_score: number | null
          error_message: string | null
          expires_at: string | null
          file_path: string | null
          file_size: number | null
          id: string
          language: string | null
          metadata: Json
          pdf_metadata: Json | null
          provider: string | null
          signed_url: string | null
          status: string
          story_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_metadata?: Json | null
          child_id?: string | null
          created_at?: string
          dap_score?: number | null
          error_message?: string | null
          expires_at?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          language?: string | null
          metadata?: Json
          pdf_metadata?: Json | null
          provider?: string | null
          signed_url?: string | null
          status?: string
          story_id?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_metadata?: Json | null
          child_id?: string | null
          created_at?: string
          dap_score?: number | null
          error_message?: string | null
          expires_at?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          language?: string | null
          metadata?: Json
          pdf_metadata?: Json | null
          provider?: string | null
          signed_url?: string | null
          status?: string
          story_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exports_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      file_scan_jobs: {
        Row: {
          attempts: number
          created_at: string
          declared_mime: string | null
          error: string | null
          id: string
          scan_result: Json
          size_bytes: number | null
          status: string
          target_bucket: string
          target_path: string
          temp_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          declared_mime?: string | null
          error?: string | null
          id?: string
          scan_result?: Json
          size_bytes?: number | null
          status?: string
          target_bucket: string
          target_path: string
          temp_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          declared_mime?: string | null
          error?: string | null
          id?: string
          scan_result?: Json
          size_bytes?: number | null
          status?: string
          target_bucket?: string
          target_path?: string
          temp_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_audio_files: {
        Row: {
          created_at: string
          duration_sec: number | null
          error: string | null
          id: string
          size_bytes: number | null
          status: string
          text_hash: string | null
          text_preview: string | null
          url: string | null
          user_id: string | null
          voice_id: string | null
        }
        Insert: {
          created_at?: string
          duration_sec?: number | null
          error?: string | null
          id?: string
          size_bytes?: number | null
          status?: string
          text_hash?: string | null
          text_preview?: string | null
          url?: string | null
          user_id?: string | null
          voice_id?: string | null
        }
        Update: {
          created_at?: string
          duration_sec?: number | null
          error?: string | null
          id?: string
          size_bytes?: number | null
          status?: string
          text_hash?: string | null
          text_preview?: string | null
          url?: string | null
          user_id?: string | null
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_audio_files_voice_id_fkey"
            columns: ["voice_id"]
            isOneToOne: false
            referencedRelation: "audio_voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_illustrations: {
        Row: {
          character_profile_hash: string | null
          created_at: string
          id: string
          image_url: string | null
          page_index: number
          prompt: string
          status: string
          story_id: string
          style: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          character_profile_hash?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          page_index: number
          prompt: string
          status?: string
          story_id: string
          style?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          character_profile_hash?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          page_index?: number
          prompt?: string
          status?: string
          story_id?: string
          style?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_illustrations_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "ai_story_history"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_pdfs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          metadata: Json
          size_bytes: number | null
          status: string
          story_id: string | null
          template_id: string | null
          title: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          size_bytes?: number | null
          status?: string
          story_id?: string | null
          template_id?: string | null
          title?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          size_bytes?: number | null
          status?: string
          story_id?: string | null
          template_id?: string | null
          title?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_pdfs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "pdf_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      illustration_analytics_audit: {
        Row: {
          admin_user_id: string
          filter_idempotency_key: string | null
          filter_range: string | null
          filter_story_id: string | null
          id: string
          path: string | null
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          admin_user_id: string
          filter_idempotency_key?: string | null
          filter_range?: string | null
          filter_story_id?: string | null
          id?: string
          path?: string | null
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          admin_user_id?: string
          filter_idempotency_key?: string | null
          filter_range?: string | null
          filter_story_id?: string | null
          id?: string
          path?: string | null
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: []
      }
      illustration_credits: {
        Row: {
          balance: number
          created_at: string
          last_reset_at: string | null
          lifetime_only: boolean
          monthly_allocation: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          last_reset_at?: string | null
          lifetime_only?: boolean
          monthly_allocation?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          last_reset_at?: string | null
          lifetime_only?: boolean
          monthly_allocation?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      illustration_job_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          idempotency_key: string
          page_signature: string
          result: Json
          story_id: string
          user_id: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          idempotency_key: string
          page_signature: string
          result: Json
          story_id: string
          user_id: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          idempotency_key?: string
          page_signature?: string
          result?: Json
          story_id?: string
          user_id?: string
        }
        Relationships: []
      }
      illustration_job_events: {
        Row: {
          created_at: string
          details: Json
          error: string | null
          event: string
          id: string
          idempotency_key: string | null
          latency_ms: number | null
          page_index: number | null
          source: string | null
          status: string | null
          story_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          error?: string | null
          event: string
          id?: string
          idempotency_key?: string | null
          latency_ms?: number | null
          page_index?: number | null
          source?: string | null
          status?: string | null
          story_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          error?: string | null
          event?: string
          id?: string
          idempotency_key?: string | null
          latency_ms?: number | null
          page_index?: number | null
          source?: string | null
          status?: string | null
          story_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      manual_payment_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          currency: string
          id: string
          method: string
          plan_tier: string
          proof_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sender_name: string | null
          sender_phone: string | null
          status: string
          transaction_ref: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          currency?: string
          id?: string
          method: string
          plan_tier: string
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string
          transaction_ref?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string
          plan_tier?: string
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string
          transaction_ref?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      n8n_integration_secrets: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      n8n_integration_settings: {
        Row: {
          created_at: string
          id: string
          last_test_message: string | null
          last_test_status: string | null
          last_tested_at: string | null
          mp3_enabled: boolean
          mp3_path: string
          pdf_enabled: boolean
          pdf_path: string
          story_enabled: boolean
          story_webhook_url: string | null
          txt_enabled: boolean
          txt_path: string
          updated_at: string
          updated_by: string | null
          webhook_base_url: string | null
          webhook_secret_set: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          last_test_message?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          mp3_enabled?: boolean
          mp3_path?: string
          pdf_enabled?: boolean
          pdf_path?: string
          story_enabled?: boolean
          story_webhook_url?: string | null
          txt_enabled?: boolean
          txt_path?: string
          updated_at?: string
          updated_by?: string | null
          webhook_base_url?: string | null
          webhook_secret_set?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          last_test_message?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          mp3_enabled?: boolean
          mp3_path?: string
          pdf_enabled?: boolean
          pdf_path?: string
          story_enabled?: boolean
          story_webhook_url?: string | null
          txt_enabled?: boolean
          txt_path?: string
          updated_at?: string
          updated_by?: string | null
          webhook_base_url?: string | null
          webhook_secret_set?: boolean
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          currency: string
          id: string
          order_id: string
          product_id: string
          product_snapshot: Json
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          currency: string
          id?: string
          order_id: string
          product_id: string
          product_snapshot?: Json
          quantity?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          product_id?: string
          product_snapshot?: Json
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notifications: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          event: string
          id: string
          order_id: string
          payload: Json
          recipient: string | null
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          error?: string | null
          event: string
          id?: string
          order_id: string
          payload?: Json
          recipient?: string | null
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          order_id?: string
          payload?: Json
          recipient?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          admin_note: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          fulfilled_at: string | null
          fulfilled_by: string | null
          fulfillment_status: string
          id: string
          notes: string | null
          paddle_checkout_id: string | null
          paddle_transaction_id: string | null
          paid_at: string | null
          payment_method: string | null
          payment_request_id: string | null
          shipped_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_name: string | null
          shipping_phone: string | null
          shipping_status: string
          status: string
          total_amount: number
          tracking_carrier: string | null
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          fulfillment_status?: string
          id?: string
          notes?: string | null
          paddle_checkout_id?: string | null
          paddle_transaction_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_request_id?: string | null
          shipped_at?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_name?: string | null
          shipping_phone?: string | null
          shipping_status?: string
          status?: string
          total_amount?: number
          tracking_carrier?: string | null
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          fulfillment_status?: string
          id?: string
          notes?: string | null
          paddle_checkout_id?: string | null
          paddle_transaction_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_request_id?: string | null
          shipped_at?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_name?: string | null
          shipping_phone?: string | null
          shipping_status?: string
          status?: string
          total_amount?: number
          tracking_carrier?: string | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "manual_payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      paddle_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          paddle_customer_id: string | null
          paddle_price_id: string | null
          paddle_subscription_id: string
          raw: Json
          status: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          paddle_customer_id?: string | null
          paddle_price_id?: string | null
          paddle_subscription_id: string
          raw?: Json
          status?: string
          tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          paddle_customer_id?: string | null
          paddle_price_id?: string | null
          paddle_subscription_id?: string
          raw?: Json
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      paddle_transactions: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string | null
          event_type: string
          id: string
          occurred_at: string | null
          paddle_customer_id: string | null
          paddle_price_id: string | null
          paddle_subscription_id: string | null
          paddle_transaction_id: string | null
          raw: Json
          status: string | null
          tier: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          event_type: string
          id?: string
          occurred_at?: string | null
          paddle_customer_id?: string | null
          paddle_price_id?: string | null
          paddle_subscription_id?: string | null
          paddle_transaction_id?: string | null
          raw?: Json
          status?: string | null
          tier?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          event_type?: string
          id?: string
          occurred_at?: string | null
          paddle_customer_id?: string | null
          paddle_price_id?: string | null
          paddle_subscription_id?: string | null
          paddle_transaction_id?: string | null
          raw?: Json
          status?: string | null
          tier?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      paddle_webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      payment_customers: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          provider: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          provider: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          provider?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_currencies: string[]
          bank_enabled: boolean
          bank_iban: string | null
          bank_info: Json
          bank_name: string | null
          bank_swift: string | null
          id: string
          instapay_currencies: string[]
          instapay_enabled: boolean
          instapay_handle: string | null
          instructions_ar: string | null
          instructions_en: string | null
          payoneer_currencies: string[]
          payoneer_email: string | null
          payoneer_enabled: boolean
          updated_at: string
          vodafone_currencies: string[]
          vodafone_enabled: boolean
          vodafone_number: string | null
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_currencies?: string[]
          bank_enabled?: boolean
          bank_iban?: string | null
          bank_info?: Json
          bank_name?: string | null
          bank_swift?: string | null
          id?: string
          instapay_currencies?: string[]
          instapay_enabled?: boolean
          instapay_handle?: string | null
          instructions_ar?: string | null
          instructions_en?: string | null
          payoneer_currencies?: string[]
          payoneer_email?: string | null
          payoneer_enabled?: boolean
          updated_at?: string
          vodafone_currencies?: string[]
          vodafone_enabled?: boolean
          vodafone_number?: string | null
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_currencies?: string[]
          bank_enabled?: boolean
          bank_iban?: string | null
          bank_info?: Json
          bank_name?: string | null
          bank_swift?: string | null
          id?: string
          instapay_currencies?: string[]
          instapay_enabled?: boolean
          instapay_handle?: string | null
          instructions_ar?: string | null
          instructions_en?: string | null
          payoneer_currencies?: string[]
          payoneer_email?: string | null
          payoneer_enabled?: boolean
          updated_at?: string
          vodafone_currencies?: string[]
          vodafone_enabled?: boolean
          vodafone_number?: string | null
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          id: string
          metadata: Json | null
          provider: string
          status: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          provider: string
          status?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          status?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pdf_templates: {
        Row: {
          active: boolean
          branding: Json
          created_at: string
          description: string | null
          footer_html: string | null
          header_html: string | null
          id: string
          is_default: boolean
          layout: Json
          name: string
          orientation: string
          page_size: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          branding?: Json
          created_at?: string
          description?: string | null
          footer_html?: string | null
          header_html?: string | null
          id?: string
          is_default?: boolean
          layout?: Json
          name: string
          orientation?: string
          page_size?: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          branding?: Json
          created_at?: string
          description?: string | null
          footer_html?: string | null
          header_html?: string | null
          id?: string
          is_default?: boolean
          layout?: Json
          name?: string
          orientation?: string
          page_size?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          age_range: string | null
          category: string | null
          created_at: string
          description: Json
          featured: boolean
          gallery: Json
          id: string
          image: string | null
          name: Json
          paddle_price_id: string | null
          paddle_product_id: string | null
          price_egp: number | null
          price_eur: number | null
          price_usd: number | null
          sku: string | null
          stock: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          age_range?: string | null
          category?: string | null
          created_at?: string
          description?: Json
          featured?: boolean
          gallery?: Json
          id?: string
          image?: string | null
          name?: Json
          paddle_price_id?: string | null
          paddle_product_id?: string | null
          price_egp?: number | null
          price_eur?: number | null
          price_usd?: number | null
          sku?: string | null
          stock?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          age_range?: string | null
          category?: string | null
          created_at?: string
          description?: Json
          featured?: boolean
          gallery?: Json
          id?: string
          image?: string | null
          name?: Json
          paddle_price_id?: string | null
          paddle_product_id?: string | null
          price_egp?: number | null
          price_eur?: number | null
          price_usd?: number | null
          sku?: string | null
          stock?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          preferred_language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          preferred_language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          preferred_language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_blocks: {
        Row: {
          blocked_until: string
          created_at: string
          endpoint: string
          id: string
          identifier: string
          reason: string | null
        }
        Insert: {
          blocked_until: string
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          reason?: string | null
        }
        Update: {
          blocked_until?: string
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          reason?: string | null
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          created_at: string
          endpoint: string
          id: number
          identifier: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: number
          identifier: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: number
          identifier?: string
        }
        Relationships: []
      }
      rbac_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_key?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      reading_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_active_date: string | null
          longest_streak: number
          total_minutes: number
          total_stories_read: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_active_date?: string | null
          longest_streak?: number
          total_minutes?: number
          total_stories_read?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_active_date?: string | null
          longest_streak?: number
          total_minutes?: number
          total_stories_read?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          age_range: string | null
          audio_url: string | null
          category: string | null
          content: Json
          created_at: string
          created_by: string | null
          description: Json
          duration: string | null
          gallery: Json
          id: string
          image: string | null
          metadata: Json | null
          pages: Json | null
          pdf_url: string | null
          published: boolean
          request_id: string | null
          title: Json
          updated_at: string
          video_embed_url: string | null
          views: number
        }
        Insert: {
          age_range?: string | null
          audio_url?: string | null
          category?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          description?: Json
          duration?: string | null
          gallery?: Json
          id?: string
          image?: string | null
          metadata?: Json | null
          pages?: Json | null
          pdf_url?: string | null
          published?: boolean
          request_id?: string | null
          title?: Json
          updated_at?: string
          video_embed_url?: string | null
          views?: number
        }
        Update: {
          age_range?: string | null
          audio_url?: string | null
          category?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          description?: Json
          duration?: string | null
          gallery?: Json
          id?: string
          image?: string | null
          metadata?: Json | null
          pages?: Json | null
          pdf_url?: string | null
          published?: boolean
          request_id?: string | null
          title?: Json
          updated_at?: string
          video_embed_url?: string | null
          views?: number
        }
        Relationships: []
      }
      story_generation_settings: {
        Row: {
          banned_words: string[]
          cinematic_fields_enabled: Json
          created_at: string
          default_visual_style: string
          id: string
          max_regenerations: number
          model: string
          quality_threshold: number
          singleton: boolean
          system_prompt_override: string | null
          temperature: number
          updated_at: string
          user_prompt_addendum: string | null
        }
        Insert: {
          banned_words?: string[]
          cinematic_fields_enabled?: Json
          created_at?: string
          default_visual_style?: string
          id?: string
          max_regenerations?: number
          model?: string
          quality_threshold?: number
          singleton?: boolean
          system_prompt_override?: string | null
          temperature?: number
          updated_at?: string
          user_prompt_addendum?: string | null
        }
        Update: {
          banned_words?: string[]
          cinematic_fields_enabled?: Json
          created_at?: string
          default_visual_style?: string
          id?: string
          max_regenerations?: number
          model?: string
          quality_threshold?: number
          singleton?: boolean
          system_prompt_override?: string | null
          temperature?: number
          updated_at?: string
          user_prompt_addendum?: string | null
        }
        Relationships: []
      }
      story_media: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          provider: string
          status: Database["public"]["Enums"]["media_status"]
          story_id: string
          type: Database["public"]["Enums"]["media_type"]
          updated_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          provider: string
          status?: Database["public"]["Enums"]["media_status"]
          story_id: string
          type: Database["public"]["Enums"]["media_type"]
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          status?: Database["public"]["Enums"]["media_status"]
          story_id?: string
          type?: Database["public"]["Enums"]["media_type"]
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      story_music_cache: {
        Row: {
          audio_url: string
          cache_key: string
          created_at: string
          duration_seconds: number
          id: string
          mood: string
          theme: string
        }
        Insert: {
          audio_url: string
          cache_key: string
          created_at?: string
          duration_seconds?: number
          id?: string
          mood: string
          theme: string
        }
        Update: {
          audio_url?: string
          cache_key?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          mood?: string
          theme?: string
        }
        Relationships: []
      }
      story_requests: {
        Row: {
          child_id: string | null
          created_at: string
          estimated_reading_time: number
          id: string
          language: string
          page_count: number
          preferences: Json
          reading_level: string
          sel_goal: string
          status: Database["public"]["Enums"]["story_status"]
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          estimated_reading_time?: number
          id?: string
          language?: string
          page_count?: number
          preferences?: Json
          reading_level: string
          sel_goal: string
          status?: Database["public"]["Enums"]["story_status"]
          theme: string
          updated_at?: string
          user_id: string
        }
        Update: {
          child_id?: string | null
          created_at?: string
          estimated_reading_time?: number
          id?: string
          language?: string
          page_count?: number
          preferences?: Json
          reading_level?: string
          sel_goal?: string
          status?: Database["public"]["Enums"]["story_status"]
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_requests_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_safety_reports: {
        Row: {
          bibliotherapy_check: Json
          bowlby_check: Json
          created_at: string
          goleman_check: Json
          ibby_check: Json
          id: string
          notes: string | null
          passed: boolean
          piaget_check: Json
          quality_rubric: Json
          story_id: string
          total_score: number
          trauma_reject_check: Json
          user_id: string
          vygotsky_check: Json
        }
        Insert: {
          bibliotherapy_check?: Json
          bowlby_check?: Json
          created_at?: string
          goleman_check?: Json
          ibby_check?: Json
          id?: string
          notes?: string | null
          passed?: boolean
          piaget_check?: Json
          quality_rubric?: Json
          story_id: string
          total_score?: number
          trauma_reject_check?: Json
          user_id: string
          vygotsky_check?: Json
        }
        Update: {
          bibliotherapy_check?: Json
          bowlby_check?: Json
          created_at?: string
          goleman_check?: Json
          ibby_check?: Json
          id?: string
          notes?: string | null
          passed?: boolean
          piaget_check?: Json
          quality_rubric?: Json
          story_id?: string
          total_score?: number
          trauma_reject_check?: Json
          user_id?: string
          vygotsky_check?: Json
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          plan_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          plan_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          plan_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean
          allow_audio: boolean
          allow_byok: boolean
          allow_illustrations: boolean
          allow_pdf: boolean
          created_at: string
          credits_reset_monthly: boolean
          daily_story_limit: number
          description: Json
          features: Json
          id: string
          illustration_credits: number
          is_featured: boolean
          monthly_story_limit: number
          name: Json
          paddle_price_id: string | null
          paddle_product_id: string | null
          price_egp: number
          price_usd: number
          sort_order: number
          tier: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_audio?: boolean
          allow_byok?: boolean
          allow_illustrations?: boolean
          allow_pdf?: boolean
          created_at?: string
          credits_reset_monthly?: boolean
          daily_story_limit?: number
          description?: Json
          features?: Json
          id?: string
          illustration_credits?: number
          is_featured?: boolean
          monthly_story_limit?: number
          name?: Json
          paddle_price_id?: string | null
          paddle_product_id?: string | null
          price_egp?: number
          price_usd?: number
          sort_order?: number
          tier: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_audio?: boolean
          allow_byok?: boolean
          allow_illustrations?: boolean
          allow_pdf?: boolean
          created_at?: string
          credits_reset_monthly?: boolean
          daily_story_limit?: number
          description?: Json
          features?: Json
          id?: string
          illustration_credits?: number
          is_featured?: boolean
          monthly_story_limit?: number
          name?: Json
          paddle_price_id?: string | null
          paddle_product_id?: string | null
          price_egp?: number
          price_usd?: number
          sort_order?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      trial_usage: {
        Row: {
          child_name: string | null
          created_at: string
          error_code: string | null
          fallback_used: boolean
          fingerprint: string
          id: string
          ip: string | null
          latency_ms: number | null
          model: string | null
          pages_count: number
          provider: string | null
          stage: string | null
          story_id: string | null
          theme: string | null
          user_agent: string | null
        }
        Insert: {
          child_name?: string | null
          created_at?: string
          error_code?: string | null
          fallback_used?: boolean
          fingerprint: string
          id?: string
          ip?: string | null
          latency_ms?: number | null
          model?: string | null
          pages_count?: number
          provider?: string | null
          stage?: string | null
          story_id?: string | null
          theme?: string | null
          user_agent?: string | null
        }
        Update: {
          child_name?: string | null
          created_at?: string
          error_code?: string | null
          fallback_used?: boolean
          fingerprint?: string
          id?: string
          ip?: string | null
          latency_ms?: number | null
          model?: string | null
          pages_count?: number
          provider?: string | null
          stage?: string | null
          story_id?: string | null
          theme?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      upload_security_logs: {
        Row: {
          abuse_score: number
          action: string
          bucket: string | null
          created_at: string
          details: Json
          extension: string | null
          filename: string | null
          id: string
          ip: string | null
          mime_declared: string | null
          mime_detected: string | null
          scan_engine: string | null
          scan_signature: string | null
          size_bytes: number | null
          target_path: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          abuse_score?: number
          action: string
          bucket?: string | null
          created_at?: string
          details?: Json
          extension?: string | null
          filename?: string | null
          id?: string
          ip?: string | null
          mime_declared?: string | null
          mime_detected?: string | null
          scan_engine?: string | null
          scan_signature?: string | null
          size_bytes?: number | null
          target_path?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          abuse_score?: number
          action?: string
          bucket?: string | null
          created_at?: string
          details?: Json
          extension?: string | null
          filename?: string | null
          id?: string
          ip?: string | null
          mime_declared?: string | null
          mime_detected?: string | null
          scan_engine?: string | null
          scan_signature?: string | null
          size_bytes?: number | null
          target_path?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          resource_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          api_key: string
          api_key_ciphertext: string | null
          api_key_iv: string | null
          base_url: string | null
          capabilities: string[]
          created_at: string
          enabled: boolean
          encryption_version: number
          id: string
          image_model: string | null
          key_fingerprint: string | null
          key_last4: string | null
          label: string | null
          last_validated_at: string | null
          provider: string
          text_model: string | null
          updated_at: string
          user_id: string
          validation_status: string | null
        }
        Insert: {
          api_key: string
          api_key_ciphertext?: string | null
          api_key_iv?: string | null
          base_url?: string | null
          capabilities?: string[]
          created_at?: string
          enabled?: boolean
          encryption_version?: number
          id?: string
          image_model?: string | null
          key_fingerprint?: string | null
          key_last4?: string | null
          label?: string | null
          last_validated_at?: string | null
          provider: string
          text_model?: string | null
          updated_at?: string
          user_id: string
          validation_status?: string | null
        }
        Update: {
          api_key?: string
          api_key_ciphertext?: string | null
          api_key_iv?: string | null
          base_url?: string | null
          capabilities?: string[]
          created_at?: string
          enabled?: boolean
          encryption_version?: number
          id?: string
          image_model?: string | null
          key_fingerprint?: string | null
          key_last4?: string | null
          label?: string | null
          last_validated_at?: string | null
          provider?: string
          text_model?: string | null
          updated_at?: string
          user_id?: string
          validation_status?: string | null
        }
        Relationships: []
      }
      user_backup_settings: {
        Row: {
          enabled: boolean
          id: boolean
          max_size_mb_per_user: number
          notify_on_failure: boolean
          notify_on_success: boolean
          retention_days: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          max_size_mb_per_user?: number
          notify_on_failure?: boolean
          notify_on_success?: boolean
          retention_days?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: boolean
          max_size_mb_per_user?: number
          notify_on_failure?: boolean
          notify_on_success?: boolean
          retention_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_backups: {
        Row: {
          backup_date: string
          created_at: string
          error_message: string | null
          expires_at: string
          id: string
          size_bytes: number
          status: string
          storage_path: string
          story_count: number
          user_id: string
        }
        Insert: {
          backup_date: string
          created_at?: string
          error_message?: string | null
          expires_at?: string
          id?: string
          size_bytes?: number
          status?: string
          storage_path: string
          story_count?: number
          user_id: string
        }
        Update: {
          backup_date?: string
          created_at?: string
          error_message?: string | null
          expires_at?: string
          id?: string
          size_bytes?: number
          status?: string
          storage_path?: string
          story_count?: number
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string | null
          metadata: Json | null
          read_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          payment_method: string | null
          payment_request_id: string | null
          plan_tier: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_method?: string | null
          payment_request_id?: string | null
          plan_tier?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_method?: string | null
          payment_request_id?: string | null
          plan_tier?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          age_range: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: Json
          duration: string | null
          id: string
          published: boolean
          source_type: string
          thumbnail: string | null
          title: Json
          updated_at: string
          video_url: string | null
          views: number
        }
        Insert: {
          age_range?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: Json
          duration?: string | null
          id?: string
          published?: boolean
          source_type?: string
          thumbnail?: string | null
          title?: Json
          updated_at?: string
          video_url?: string | null
          views?: number
        }
        Update: {
          age_range?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: Json
          duration?: string | null
          id?: string
          published?: boolean
          source_type?: string
          thumbnail?: string | null
          title?: Json
          updated_at?: string
          video_url?: string | null
          views?: number
        }
        Relationships: []
      }
      voice_configs: {
        Row: {
          age_group: string | null
          created_at: string
          display_name: string | null
          emotion_hint: string | null
          gender: string | null
          id: string
          is_active: boolean
          is_default: boolean
          language_code: string
          provider: string
          sample_url: string | null
          voice_id: string
        }
        Insert: {
          age_group?: string | null
          created_at?: string
          display_name?: string | null
          emotion_hint?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          language_code: string
          provider: string
          sample_url?: string | null
          voice_id: string
        }
        Update: {
          age_group?: string | null
          created_at?: string
          display_name?: string | null
          emotion_hint?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          language_code?: string
          provider?: string
          sample_url?: string | null
          voice_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          notified: boolean
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          notified?: boolean
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          notified?: boolean
          source?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      site_stats: {
        Row: {
          total_drawings: number | null
          total_stories: number | null
          total_users: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_manual_payment: {
        Args: { _months?: number; _request_id: string }
        Returns: string
      }
      check_story_quota: { Args: { _user_id: string }; Returns: Json }
      cleanup_rate_limit_data: { Args: never; Returns: undefined }
      cleanup_rate_limit_events: { Args: never; Returns: number }
      cleanup_upload_pipeline: { Args: never; Returns: undefined }
      consume_credits: {
        Args: { _n: number; _user_id: string }
        Returns: number
      }
      consume_illustration_credits: {
        Args: { _amount: number; _user_id: string }
        Returns: Json
      }
      expire_due_subscriptions: { Args: never; Returns: number }
      get_active_paddle_tier: { Args: { _user_id: string }; Returns: string }
      get_active_voice_profiles: {
        Args: never
        Returns: {
          description: string
          gender: string
          id: string
          is_default: boolean
          language: string
          name: string
          provider: string
          sample_url: string
          voice_id: string
        }[]
      }
      get_download_settings_public: {
        Args: never
        Returns: {
          daily_limit_per_user: number
          enable_docx: boolean
          enable_epub: boolean
          enable_images: boolean
          enable_mp3: boolean
          enable_pack: boolean
          enable_pdf: boolean
          enable_txt: boolean
          max_file_size_mb: number
        }[]
      }
      grant_credits: { Args: { _n: number; _user_id: string }; Returns: number }
      has_paid_feature: {
        Args: { _feature: string; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refund_illustration_credits: {
        Args: { _amount: number; _user_id: string }
        Returns: undefined
      }
      registration_allowed: { Args: never; Returns: boolean }
      reject_manual_payment: {
        Args: { _reason?: string; _request_id: string }
        Returns: undefined
      }
      reset_monthly_credits: { Args: never; Returns: number }
      reset_monthly_illustration_credits: { Args: never; Returns: number }
      user_daily_upload_bytes: { Args: { _user_id: string }; Returns: number }
    }
    Enums: {
      ai_limit_scope: "global" | "role" | "user"
      ai_tone:
        | "professional"
        | "friendly"
        | "educational"
        | "marketing"
        | "custom"
      ai_usage_status: "success" | "error" | "blocked" | "quota_exceeded"
      app_role: "admin" | "user" | "editor" | "super_admin" | "support"
      media_status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
      media_type: "ILLUSTRATION" | "AUDIO" | "PDF"
      story_status:
        | "draft"
        | "queued"
        | "generating"
        | "generated"
        | "illustrating"
        | "narrating"
        | "completed"
        | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_limit_scope: ["global", "role", "user"],
      ai_tone: [
        "professional",
        "friendly",
        "educational",
        "marketing",
        "custom",
      ],
      ai_usage_status: ["success", "error", "blocked", "quota_exceeded"],
      app_role: ["admin", "user", "editor", "super_admin", "support"],
      media_status: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      media_type: ["ILLUSTRATION", "AUDIO", "PDF"],
      story_status: [
        "draft",
        "queued",
        "generating",
        "generated",
        "illustrating",
        "narrating",
        "completed",
        "failed",
      ],
    },
  },
} as const

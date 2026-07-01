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
      blockers: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_by: string
          resolution_note: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_by: string
          resolution_note?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_by?: string
          resolution_note?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blockers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications_queue: {
        Row: {
          attempts: number
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          last_error: string | null
          recipient_user_id: string
          related_project_id: string | null
          related_task_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string
        }
        Insert: {
          attempts?: number
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          last_error?: string | null
          recipient_user_id: string
          related_project_id?: string | null
          related_task_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject: string
        }
        Update: {
          attempts?: number
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          last_error?: string | null
          recipient_user_id?: string
          related_project_id?: string | null
          related_task_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_queue_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_queue_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          telegram_chat_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          telegram_chat_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          telegram_chat_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          project_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          project_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stages: {
        Row: {
          completed_at: string | null
          created_at: string
          deadline: string | null
          description: string | null
          expected_days: number
          id: string
          name: string
          order_index: number
          project_id: string
          requires_attachments: boolean
          requires_financial: boolean
          stage_type: Database["public"]["Enums"]["stage_type"]
          status: Database["public"]["Enums"]["stage_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          expected_days?: number
          id?: string
          name: string
          order_index: number
          project_id: string
          requires_attachments?: boolean
          requires_financial?: boolean
          stage_type?: Database["public"]["Enums"]["stage_type"]
          status?: Database["public"]["Enums"]["stage_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          expected_days?: number
          id?: string
          name?: string
          order_index?: number
          project_id?: string
          requires_attachments?: boolean
          requires_financial?: boolean
          stage_type?: Database["public"]["Enums"]["stage_type"]
          status?: Database["public"]["Enums"]["stage_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_name: string | null
          collected_amount: number | null
          created_at: string
          created_by: string | null
          description: string | null
          expected_end_date: string | null
          id: string
          name: string
          project_type: Database["public"]["Enums"]["project_type"]
          purchase_cost: number | null
          start_date: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          collected_amount?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_end_date?: string | null
          id?: string
          name: string
          project_type: Database["public"]["Enums"]["project_type"]
          purchase_cost?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          collected_amount?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_end_date?: string | null
          id?: string
          name?: string
          project_type?: Database["public"]["Enums"]["project_type"]
          purchase_cost?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_at: string
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          escalated_at: string | null
          id: string
          last_reminder_sent_at: string | null
          paused_at: string | null
          stage_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          escalated_at?: string | null
          id?: string
          last_reminder_sent_at?: string | null
          paused_at?: string | null
          stage_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          escalated_at?: string | null
          id?: string
          last_reminder_sent_at?: string | null
          paused_at?: string | null
          stage_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id"]
          },
        ]
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
      webhook_deliveries: {
        Row: {
          created_at: string
          delivered_at: string | null
          error: string | null
          event: string
          id: string
          payload: Json
          status_code: number | null
          webhook_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          event: string
          id?: string
          payload: Json
          status_code?: number | null
          webhook_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          event?: string
          id?: string
          payload?: Json
          status_code?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          events: string[]
          id: string
          name: string
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          name: string
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          name?: string
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      workflow_template_stages: {
        Row: {
          created_at: string
          description: string | null
          expected_days: number
          id: string
          name: string
          order_index: number
          requires_attachments: boolean
          requires_financial: boolean
          stage_type: Database["public"]["Enums"]["stage_type"]
          template_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expected_days?: number
          id?: string
          name: string
          order_index: number
          requires_attachments?: boolean
          requires_financial?: boolean
          stage_type?: Database["public"]["Enums"]["stage_type"]
          template_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expected_days?: number
          id?: string
          name?: string
          order_index?: number
          requires_attachments?: boolean
          requires_financial?: boolean
          stage_type?: Database["public"]["Enums"]["stage_type"]
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_template_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          project_type: Database["public"]["Enums"]["project_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          project_type: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          project_type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      user_has_task_in_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee"
      notification_channel: "email" | "telegram"
      notification_kind:
        | "task_assigned"
        | "task_reminder"
        | "task_overdue"
        | "task_escalation"
        | "blocker_reported"
      notification_status: "pending" | "sent" | "failed"
      project_status: "active" | "completed" | "cancelled" | "on_hold"
      project_type: "tender" | "direct"
      stage_status: "pending" | "in_progress" | "completed" | "blocked"
      stage_type: "progress" | "informational"
      task_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "blocked"
        | "overdue"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "employee"],
      notification_channel: ["email", "telegram"],
      notification_kind: [
        "task_assigned",
        "task_reminder",
        "task_overdue",
        "task_escalation",
        "blocker_reported",
      ],
      notification_status: ["pending", "sent", "failed"],
      project_status: ["active", "completed", "cancelled", "on_hold"],
      project_type: ["tender", "direct"],
      stage_status: ["pending", "in_progress", "completed", "blocked"],
      stage_type: ["progress", "informational"],
      task_status: [
        "pending",
        "in_progress",
        "completed",
        "blocked",
        "overdue",
      ],
    },
  },
} as const

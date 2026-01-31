export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string
          name: string
          email: string
          department: string
          position: string
          hire_date: string
          active: boolean
          photo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          department: string
          position: string
          hire_date?: string
          active?: boolean
          photo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          department?: string
          position?: string
          hire_date?: string
          active?: boolean
          photo_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      evaluation_criteria: {
        Row: {
          id: string
          name: string
          description: string
          data_type: 'numeric' | 'percentage' | 'binary' | 'score'
          weight: number
          direction: 'higher_better' | 'lower_better'
          source: 'manual' | 'sheets' | 'calculated'
          display_order: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          data_type: 'numeric' | 'percentage' | 'binary' | 'score'
          weight: number
          direction: 'higher_better' | 'lower_better'
          source: 'manual' | 'sheets' | 'calculated'
          display_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          data_type?: 'numeric' | 'percentage' | 'binary' | 'score'
          weight?: number
          direction?: 'higher_better' | 'lower_better'
          source?: 'manual' | 'sheets' | 'calculated'
          display_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      employee_scores: {
        Row: {
          id: string
          employee_id: string
          criterion_id: string
          period: string
          raw_value: number
          normalized_score: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          criterion_id: string
          period: string
          raw_value: number
          normalized_score?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          criterion_id?: string
          period?: string
          raw_value?: number
          normalized_score?: number
          created_at?: string
          updated_at?: string
        }
      }
      employee_rankings: {
        Row: {
          id: string
          employee_id: string
          period: string
          total_score: number
          rank_position: number
          department: string
          created_at: string
          updated_at: string
          employee_name: string
          photo_url: string | null
          criterion_details: Json | null
        }
        Insert: {
          id?: string
          employee_id: string
          period: string
          total_score: number
          rank_position: number
          department: string
          created_at?: string
          updated_at?: string
          employee_name: string
          photo_url?: string | null
          criterion_details?: Json | null
        }
        Update: {
          id?: string
          employee_id?: string
          period?: string
          total_score?: number
          rank_position?: number
          department?: string
          created_at?: string
          updated_at?: string
          employee_name?: string
          photo_url?: string | null
          criterion_details?: Json | null
        }
      }
      sst_trainings: {
        Row: {
          id: string
          employee_id: string
          training_name: string
          training_type: string
          completion_date: string
          expiry_date: string | null
          status: 'valid' | 'expired' | 'pending'
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          training_name: string
          training_type: string
          completion_date: string
          expiry_date?: string | null
          status: 'valid' | 'expired' | 'pending'
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          training_name?: string
          training_type?: string
          completion_date?: string
          expiry_date?: string | null
          status?: 'valid' | 'expired' | 'pending'
          created_at?: string
        }
      }
      sst_ppe: {
        Row: {
          id: string
          employee_id: string
          ppe_type: string
          delivery_date: string
          expiry_date: string | null
          status: 'delivered' | 'pending' | 'expired'
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          ppe_type: string
          delivery_date: string
          expiry_date?: string | null
          status: 'delivered' | 'pending' | 'expired'
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          ppe_type?: string
          delivery_date?: string
          expiry_date?: string | null
          status?: 'delivered' | 'pending' | 'expired'
          created_at?: string
        }
      }
      sst_medical_exams: {
        Row: {
          id: string
          employee_id: string
          exam_type: string
          exam_date: string
          next_exam_date: string | null
          status: 'valid' | 'expired' | 'scheduled'
          result: string
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          exam_type: string
          exam_date: string
          next_exam_date?: string | null
          status: 'valid' | 'expired' | 'scheduled'
          result?: string
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          exam_type?: string
          exam_date?: string
          next_exam_date?: string | null
          status?: 'valid' | 'expired' | 'scheduled'
          result?: string
          created_at?: string
        }
      }
      sst_incidents: {
        Row: {
          id: string
          employee_id: string
          incident_date: string
          incident_type: string
          severity: 'minor' | 'moderate' | 'severe' | 'fatal'
          description: string
          department: string
          days_lost: number
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          incident_date: string
          incident_type: string
          severity: 'minor' | 'moderate' | 'severe' | 'fatal'
          description?: string
          department: string
          days_lost?: number
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          incident_date?: string
          incident_type?: string
          severity?: 'minor' | 'moderate' | 'severe' | 'fatal'
          description?: string
          department?: string
          days_lost?: number
          created_at?: string
        }
      }
      attendance_records: {
        Row: {
          id: string
          employee_id: string
          date: string
          status: 'present' | 'absent' | 'late' | 'justified'
          hours_worked: number
          delay_minutes: number
          justification: string
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          date: string
          status: 'present' | 'absent' | 'late' | 'justified'
          hours_worked?: number
          delay_minutes?: number
          justification?: string
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          date?: string
          status?: 'present' | 'absent' | 'late' | 'justified'
          hours_worked?: number
          delay_minutes?: number
          justification?: string
          created_at?: string
        }
      }
      sheets_sync_config: {
        Row: {
          id: string
          sheet_url: string
          sheet_name: string
          data_type: string
          last_sync: string | null
          sync_enabled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          sheet_url: string
          sheet_name: string
          data_type: string
          last_sync?: string | null
          sync_enabled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          sheet_url?: string
          sheet_name?: string
          data_type?: string
          last_sync?: string | null
          sync_enabled?: boolean
          created_at?: string
        }
      }
      sst_goals: {
        Row: {
          id: string
          goal_type: string
          goal_value: number
          description: string
          is_minimum: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          goal_type: string
          goal_value: number
          description: string
          is_minimum?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          goal_type?: string
          goal_value?: number
          description?: string
          is_minimum?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      employee_comments: {
        Row: {
          id: string
          employee_id: string
          comment: string
          image_url: string | null
          created_by: string
          created_at: string
          updated_at: string
          criterion_details: Json | null
        }
        Insert: {
          id?: string
          employee_id: string
          comment: string
          image_url?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
          criterion_details?: Json | null
        }
        Update: {
          id?: string
          employee_id?: string
          comment?: string
          image_url?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

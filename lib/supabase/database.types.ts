
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor": string | null,"created_at": string,"details": NonNullable<Json>,"household_id": string | null,"id": string
                  }
                  Insert: {
                    "action": string,"actor"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"household_id"?: string | null,"id"?: string
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"household_id"?: string | null,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"chore_assignees": {
                  Row: {
                    "chore_id": string,"household_id": string,"kid_id": string
                  }
                  Insert: {
                    "chore_id": string,"household_id": string,"kid_id": string
                  }
                  Update: {
                    "chore_id"?: string,"household_id"?: string,"kid_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chore_assignees_chore_id_fkey"
      columns: ["chore_id"]
isOneToOne: false
      referencedRelation: "chores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chore_assignees_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chore_assignees_kid_id_fkey"
      columns: ["kid_id"]
isOneToOne: false
      referencedRelation: "kid_balances"
      referencedColumns: ["kid_id"]
    },{
      foreignKeyName: "chore_assignees_kid_id_fkey"
      columns: ["kid_id"]
isOneToOne: false
      referencedRelation: "kids"
      referencedColumns: ["id"]
    }
                  ]
                },"chore_claims": {
                  Row: {
                    "chore_id": string,"claimed_at": string,"device_id": string | null,"expires_at": string,"household_id": string,"id": string,"kid_id": string,"quantity": number,"release_reason": string | null,"released_at": string | null,"submission_id": string | null
                  }
                  Insert: {
                    "chore_id": string,"claimed_at"?: string,"device_id"?: string | null,"expires_at": string,"household_id": string,"id"?: string,"kid_id": string,"quantity"?: number,"release_reason"?: string | null,"released_at"?: string | null,"submission_id"?: string | null
                  }
                  Update: {
                    "chore_id"?: string,"claimed_at"?: string,"device_id"?: string | null,"expires_at"?: string,"household_id"?: string,"id"?: string,"kid_id"?: string,"quantity"?: number,"release_reason"?: string | null,"released_at"?: string | null,"submission_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "chore_claims_chore_id_fkey"
      columns: ["chore_id"]
isOneToOne: false
      referencedRelation: "chores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chore_claims_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chore_claims_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chore_claims_kid_id_fkey"
      columns: ["kid_id"]
isOneToOne: false
      referencedRelation: "kid_balances"
      referencedColumns: ["kid_id"]
    },{
      foreignKeyName: "chore_claims_kid_id_fkey"
      columns: ["kid_id"]
isOneToOne: false
      referencedRelation: "kids"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chore_claims_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"chore_subtask_checks": {
                  Row: {
                    "checked_at": string,"chore_id": string,"device_id": string | null,"household_id": string,"kid_id": string,"period_key": string,"subtask_id": string
                  }
                  Insert: {
                    "checked_at"?: string,"chore_id": string,"device_id"?: string | null,"household_id": string,"kid_id": string,"period_key": string,"subtask_id": string
                  }
                  Update: {
                    "checked_at"?: string,"chore_id"?: string,"device_id"?: string | null,"household_id"?: string,"kid_id"?: string,"period_key"?: string,"subtask_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chore_subtask_checks_chore_id_fkey"
      columns: ["chore_id"]
isOneToOne: false
      referencedRelation: "chores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chore_subtask_checks_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chore_subtask_checks_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chore_subtask_checks_kid_id_fkey"
      columns: ["kid_id"]
isOneToOne: false
      referencedRelation: "kid_balances"
      referencedColumns: ["kid_id"]
    },{
      foreignKeyName: "chore_subtask_checks_kid_id_fkey"
      columns: ["kid_id"]
isOneToOne: false
      referencedRelation: "kids"
      referencedColumns: ["id"]
    }
                  ]
                },"chore_templates": {
                  Row: {
                    "category": string | null,"description": string | null,"emoji": string | null,"key": string,"locale": string,"max_quantity": number,"price_cents": number,"repeat_every_days": number | null,"repeat_kind": string,"scope": string,"season": string | null,"sort_order": number,"subtasks": NonNullable<Json>,"title": string,"unit_label": string | null
                  }
                  Insert: {
                    "category"?: string | null,"description"?: string | null,"emoji"?: string | null,"key": string,"locale"?: string,"max_quantity"?: number,"price_cents": number,"repeat_every_days"?: number | null,"repeat_kind": string,"scope"?: string,"season"?: string | null,"sort_order"?: number,"subtasks"?: NonNullable<Json>,"title": string,"unit_label"?: string | null
                  }
                  Update: {
                    "category"?: string | null,"description"?: string | null,"emoji"?: string | null,"key"?: string,"locale"?: string,"max_quantity"?: number,"price_cents"?: number,"repeat_every_days"?: number | null,"repeat_kind"?: string,"scope"?: string,"season"?: string | null,"sort_order"?: number,"subtasks"?: NonNullable<Json>,"title"?: string,"unit_label"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"chores": {
                  Row: {
                    "active": boolean,"available_from": string | null,"available_until": string | null,"category": string,"claim_window": string,"color": string | null,"created_at": string,"description": string | null,"emoji": string | null,"household_id": string,"id": string,"max_quantity": number,"note_for_kids": string | null,"price_cents": number,"repeat_every_days": number | null,"repeat_kind": string,"requires_approval": boolean,"reset_at": string | null,"scope": string,"sort_order": number,"subtasks": NonNullable<Json>,"template_key": string | null,"title": string,"translations": NonNullable<Json>,"unit_label": string | null,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"available_from"?: string | null,"available_until"?: string | null,"category"?: string,"claim_window"?: string,"color"?: string | null,"created_at"?: string,"description"?: string | null,"emoji"?: string | null,"household_id": string,"id"?: string,"max_quantity"?: number,"note_for_kids"?: string | null,"price_cents": number,"repeat_every_days"?: number | null,"repeat_kind": string,"requires_approval"?: boolean,"reset_at"?: string | null,"scope"?: string,"sort_order"?: number,"subtasks"?: NonNullable<Json>,"template_key"?: string | null,"title": string,"translations"?: NonNullable<Json>,"unit_label"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"available_from"?: string | null,"available_until"?: string | null,"category"?: string,"claim_window"?: string,"color"?: string | null,"created_at"?: string,"description"?: string | null,"emoji"?: string | null,"household_id"?: string,"id"?: string,"max_quantity"?: number,"note_for_kids"?: string | null,"price_cents"?: number,"repeat_every_days"?: number | null,"repeat_kind"?: string,"requires_approval"?: boolean,"reset_at"?: string | null,"scope"?: string,"sort_order"?: number,"subtasks"?: NonNullable<Json>,"template_key"?: string | null,"title"?: string,"translations"?: NonNullable<Json>,"unit_label"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chores_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"devices": {
                  Row: {
                    "created_at": string,"created_by": string | null,"household_id": string,"id": string,"last_seen_at": string | null,"name": string,"revoked_at": string | null,"token_hash": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"household_id": string,"id"?: string,"last_seen_at"?: string | null,"name"?: string,"revoked_at"?: string | null,"token_hash": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"household_id"?: string,"id"?: string,"last_seen_at"?: string | null,"name"?: string,"revoked_at"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "devices_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"email_log": {
                  Row: {
                    "household_id": string,"id": string,"kind": string,"recipient_user_id": string | null,"sent_at": string
                  }
                  Insert: {
                    "household_id": string,"id"?: string,"kind": string,"recipient_user_id"?: string | null,"sent_at"?: string
                  }
                  Update: {
                    "household_id"?: string,"id"?: string,"kind"?: string,"recipient_user_id"?: string | null,"sent_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_log_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"family_pot_spends": {
                  Row: {
                    "amount_cents": number,"created_at": string,"created_by": string | null,"household_id": string,"id": string,"note": string
                  }
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"created_by"?: string | null,"household_id": string,"id"?: string,"note": string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"created_by"?: string | null,"household_id"?: string,"id"?: string,"note"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_pot_spends_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_invites": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"expires_at": string,"household_id": string,"id": string,"invited_by": string | null,"role": string,"token_hash": string
                  }
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"expires_at": string,"household_id": string,"id"?: string,"invited_by"?: string | null,"role"?: string,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"household_id"?: string,"id"?: string,"invited_by"?: string | null,"role"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_invites_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_members": {
                  Row: {
                    "created_at": string,"display_name": string | null,"household_id": string,"pin_failed_attempts": number,"pin_hash": string | null,"pin_locked_until": string | null,"review_email_sent_at": string | null,"review_emails_enabled": boolean,"role": string,"user_id": string,"weekly_report_enabled": boolean
                  }
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"household_id": string,"pin_failed_attempts"?: number,"pin_hash"?: string | null,"pin_locked_until"?: string | null,"review_email_sent_at"?: string | null,"review_emails_enabled"?: boolean,"role": string,"user_id": string,"weekly_report_enabled"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"household_id"?: string,"pin_failed_attempts"?: number,"pin_hash"?: string | null,"pin_locked_until"?: string | null,"review_email_sent_at"?: string | null,"review_emails_enabled"?: boolean,"role"?: string,"user_id"?: string,"weekly_report_enabled"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "admin_timeout_minutes": number,"created_at": string,"created_by": string | null,"currency": string,"id": string,"kid_idle_seconds": number,"last_activity_at": string,"locale": string,"name": string,"savings_match_percent": number,"tax_enabled": boolean,"tax_percent": number,"theme": string,"timezone": string,"week_starts_on": number,"weekly_report_dow": number,"weekly_report_hour": number,"weekly_report_last_sent_at": string | null
                  }
                  Insert: {
                    "admin_timeout_minutes"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"kid_idle_seconds"?: number,"last_activity_at"?: string,"locale"?: string,"name": string,"savings_match_percent"?: number,"tax_enabled"?: boolean,"tax_percent"?: number,"theme"?: string,"timezone"?: string,"week_starts_on"?: number,"weekly_report_dow"?: number,"weekly_report_hour"?: number,"weekly_report_last_sent_at"?: string | null
                  }
                  Update: {
                    "admin_timeout_minutes"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"kid_idle_seconds"?: number,"last_activity_at"?: string,"locale"?: string,"name"?: string,"savings_match_percent"?: number,"tax_enabled"?: boolean,"tax_percent"?: number,"theme"?: string,"timezone"?: string,"week_starts_on"?: number,"weekly_report_dow"?: number,"weekly_report_hour"?: number,"weekly_report_last_sent_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"kid_checkins": {
                  Row: {
                    "created_at": string,"device_id": string | null,"household_id": string,"id": string,"kid_id": string
                  }
                  Insert: {
                    "created_at"?: string,"device_id"?: string | null,"household_id": string,"id"?: string,"kid_id": string
                  }
                  Update: {
                    "created_at"?: string,"device_id"?: string | null,"household_id"?: string,"id"?: string,"kid_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "kid_checkins_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kid_checkins_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kid_checkins_kid_id_fkey"
      columns: ["kid_id"]
isOneToOne: false
      referencedRelation: "kid_balances"
      referencedColumns: ["kid_id"]
    },{
      foreignKeyName: "kid_checkins_kid_id_fkey"
      columns: ["kid_id"]
isOneToOne: false
      referencedRelation: "kids"
      referencedColumns: ["id"]
    }
                  ]
                },"kids": {
                  Row: {
                    "archived_at": string | null,"avatar_path": string | null,"color": string,"created_at": string,"household_id": string,"id": string,"last_seen_board_at": string | null,"locale": string | null,"name": string,"sort_order": number
                  }
                  Insert: {
                    "archived_at"?: string | null,"avatar_path"?: string | null,"color"?: string,"created_at"?: string,"household_id": string,"id"?: string,"last_seen_board_at"?: string | null,"locale"?: string | null,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "archived_at"?: string | null,"avatar_path"?: string | null,"color"?: string,"created_at"?: string,"household_id"?: string,"id"?: string,"last_seen_board_at"?: string | null,"locale"?: string | null,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "kids_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"ledger_entries": {
                  Row: {
                    "amount_cents": number,"created_at": string,"created_by": string | null,"household_id": string,"icon": string | null,"id": string,"kid_id": string,"kind": string,"method": string | null,"note": string | null,"payout_id": string | null,"submission_id": string | null,"title": string | null,"translations": Json | null
                  }
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"created_by"?: string | null,"household_id": string,"icon"?: string | null,"id"?: string,"kid_id": string,"kind": string,"method"?: string | null,"note"?: string | null,"payout_id"?: string | null,"submission_id"?: string | null,"title"?: string | null,"translations"?: Json | null
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"created_by"?: string | null,"household_id"?: string,"icon"?: string | null,"id"?: string,"kid_id"?: string,"kind"?: string,"method"?: string | null,"note"?: string | null,"payout_id"?: string | null,"submission_id"?: string | null,"title"?: string | null,"translations"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ledger_entries_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_entries_kid_id_fkey"
      columns: ["kid_id"]
isOneToOne: false
      referencedRelation: "kid_balances"
      referencedColumns: ["kid_id"]
    },{
      foreignKeyName: "ledger_entries_kid_id_fkey"
      columns: ["kid_id"]
isOneToOne: false
      referencedRelation: "kids"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_entries_payout_id_fkey"
      columns: ["payout_id"]
isOneToOne: false
      referencedRelation: "ledger_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_entries_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"promotions": {
                  Row: {
                    "bonus_kind": string,"bonus_value": number,"created_at": string,"created_by": string | null,"ends_at": string,"household_id": string,"id": string,"name": string,"starts_at": string,"updated_at": string
                  }
                  Insert: {
                    "bonus_kind": string,"bonus_value": number,"created_at"?: string,"created_by"?: string | null,"ends_at": string,"household_id": string,"id"?: string,"name": string,"starts_at": string,"updated_at"?: string
                  }
                  Update: {
                    "bonus_kind"?: string,"bonus_value"?: number,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string,"household_id"?: string,"id"?: string,"name"?: string,"starts_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "promotions_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"share_invites": {
                  Row: {
                    "email": string,"household_id": string,"id": string,"joined_at": string | null,"joined_user_id": string | null,"last_sent_at": string,"locale": string,"send_count": number,"sender_user_id": string | null,"sent_at": string
                  }
                  Insert: {
                    "email": string,"household_id": string,"id"?: string,"joined_at"?: string | null,"joined_user_id"?: string | null,"last_sent_at"?: string,"locale"?: string,"send_count"?: number,"sender_user_id"?: string | null,"sent_at"?: string
                  }
                  Update: {
                    "email"?: string,"household_id"?: string,"id"?: string,"joined_at"?: string | null,"joined_user_id"?: string | null,"last_sent_at"?: string,"locale"?: string,"send_count"?: number,"sender_user_id"?: string | null,"sent_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "share_invites_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"stripe_events": {
                  Row: {
                    "created_at": string,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"type": string
                  }
                  Insert: {
                    "created_at"?: string,"id": string,"payload": NonNullable<Json>,"processed_at"?: string | null,"type": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"submission_events": {
                  Row: {
                    "actor_user_id": string | null,"comment": string | null,"created_at": string,"event": string,"household_id": string,"id": string,"submission_id": string
                  }
                  Insert: {
                    "actor_user_id"?: string | null,"comment"?: string | null,"created_at"?: string,"event": string,"household_id": string,"id"?: string,"submission_id": string
                  }
                  Update: {
                    "actor_user_id"?: string | null,"comment"?: string | null,"created_at"?: string,"event"?: string,"household_id"?: string,"id"?: string,"submission_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "submission_events_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submission_events_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"submissions": {
                  Row: {
                    "amount_cents": number,"chore_id": string,"chore_title_snapshot": string,"created_at": string,"device_id": string | null,"household_id": string,"id": string,"idempotency_key": string | null,"kid_id": string,"photo_path": string | null,"quantity": number,"resubmitted_at": string | null,"review_comment": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": string,"submitted_at": string,"unit_price_cents": number
                  }
                  Insert: {
                    "amount_cents": number,"chore_id": string,"chore_title_snapshot": string,"created_at"?: string,"device_id"?: string | null,"household_id": string,"id"?: string,"idempotency_key"?: string | null,"kid_id": string,"photo_path"?: string | null,"quantity"?: number,"resubmitted_at"?: string | null,"review_comment"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status": string,"submitted_at"?: string,"unit_price_cents": number
                  }
                  Update: {
                    "amount_cents"?: number,"chore_id"?: string,"chore_title_snapshot"?: string,"created_at"?: string,"device_id"?: string | null,"household_id"?: string,"id"?: string,"idempotency_key"?: string | null,"kid_id"?: string,"photo_path"?: string | null,"quantity"?: number,"resubmitted_at"?: string | null,"review_comment"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"submitted_at"?: string,"unit_price_cents"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "submissions_chore_id_fkey"
      columns: ["chore_id"]
isOneToOne: false
      referencedRelation: "chores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_kid_id_fkey"
      columns: ["kid_id"]
isOneToOne: false
      referencedRelation: "kid_balances"
      referencedColumns: ["kid_id"]
    },{
      foreignKeyName: "submissions_kid_id_fkey"
      columns: ["kid_id"]
isOneToOne: false
      referencedRelation: "kids"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "cancel_at_period_end": boolean,"current_period_end": string | null,"household_id": string,"past_due_since": string | null,"plan": string,"quantity": number | null,"status": string,"stripe_customer_id": string | null,"stripe_price_id": string | null,"stripe_subscription_id": string | null,"trial_ended_email_sent_at": string | null,"trial_ends_at": string | null,"trial_reminder_sent_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "cancel_at_period_end"?: boolean,"current_period_end"?: string | null,"household_id": string,"past_due_since"?: string | null,"plan"?: string,"quantity"?: number | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_price_id"?: string | null,"stripe_subscription_id"?: string | null,"trial_ended_email_sent_at"?: string | null,"trial_ends_at"?: string | null,"trial_reminder_sent_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "cancel_at_period_end"?: boolean,"current_period_end"?: string | null,"household_id"?: string,"past_due_since"?: string | null,"plan"?: string,"quantity"?: number | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_price_id"?: string | null,"stripe_subscription_id"?: string | null,"trial_ended_email_sent_at"?: string | null,"trial_ends_at"?: string | null,"trial_reminder_sent_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_household_id_fkey"
      columns: ["household_id"]
isOneToOne: true
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"push_tokens": {
                  Row: {
                    "created_at": string,"id": string,"last_seen_at": string,"locale": string | null,"platform": string,"token": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_seen_at"?: string,"locale"?: string | null,"platform": string,"token": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_seen_at"?: string,"locale"?: string | null,"platform"?: string,"token"?: string,"user_id"?: string
                  }
                  Relationships: [
                  ]
                },"support_messages": {
                  Row: {
                    "created_at": string,"email": string | null,"household_id": string | null,"id": string,"kind": string,"message": string,"page": string | null,"status": string,"user_agent": string | null,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"household_id"?: string | null,"id"?: string,"kind": string,"message": string,"page"?: string | null,"status"?: string,"user_agent"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"household_id"?: string | null,"id"?: string,"kind"?: string,"message"?: string,"page"?: string | null,"status"?: string,"user_agent"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_messages_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "kid_balances": {
                  Row: {
                    "balance_cents": number | null,"household_id": string | null,"kid_id": string | null,"pending_cents": number | null
                  }
                  Insert: {
                           "balance_cents"?: never,"household_id"?: string | null,"kid_id"?: string | null,"pending_cents"?: never
                         }
                        Update: {
                           "balance_cents"?: never,"household_id"?: string | null,"kid_id"?: string | null,"pending_cents"?: never
                         }
                        Relationships: [
                    {
      foreignKeyName: "kids_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "approve_submission":
{ Args: { "p_bonus_cents"?: number,"p_comment"?: string,"p_quantity"?: number,"p_submission_id": string,"p_unit_price_cents"?: number,"p_update_chore_price"?: boolean }; Returns: {
              "amount_cents": number,
"chore_id": string,
"chore_title_snapshot": string,
"created_at": string,
"device_id": string | null,
"household_id": string,
"id": string,
"idempotency_key": string | null,
"kid_id": string,
"photo_path": string | null,
"quantity": number,
"resubmitted_at": string | null,
"review_comment": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string,
"submitted_at": string,
"unit_price_cents": number
            }
                          SetofOptions: {
        from: "*"
        to: "submissions"
        isOneToOne: true
        isSetofReturn: false
      } },
"billing_enforced":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_write":
{ Args: { "hid": string }; Returns: boolean
                           },
"checklist_period_key":
{ Args: { "p_at": string,"p_chore_id": string,"p_kid_id": string }; Returns: string
                           },
"chore_open_for_claim":
{ Args: { "p_at": string,"p_chore_id": string,"p_kid_id": string }; Returns: boolean
                           },
"create_household":
{ Args: { "p_currency": string,"p_locale": string,"p_name": string,"p_timezone": string }; Returns: string
                           },
"email_has_account":
{ Args: { "p_email": string }; Returns: boolean
                           },
"household_has_full_access":
{ Args: { "hid": string }; Returns: boolean
                           },
"is_member":
{ Args: { "hid": string }; Returns: boolean
                           },
"is_owner":
{ Args: { "hid": string }; Returns: boolean
                           },
"is_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"kiosk_checklist_progress":
{ Args: { "p_household_id": string,"p_kid_id": string }; Returns: Json
                           },
"kiosk_claim_chore":
{ Args: { "p_chore_id": string,"p_device_id": string,"p_household_id": string,"p_kid_id": string,"p_quantity": number }; Returns: {
              "chore_id": string,
"claimed_at": string,
"device_id": string | null,
"expires_at": string,
"household_id": string,
"id": string,
"kid_id": string,
"quantity": number,
"release_reason": string | null,
"released_at": string | null,
"submission_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "chore_claims"
        isOneToOne: true
        isSetofReturn: false
      } },
"kiosk_create_submission":
{ Args: { "p_chore_id": string,"p_device_id": string,"p_expected_last_id": string,"p_household_id": string,"p_idempotency_key": string,"p_kid_id": string,"p_quantity": number }; Returns: {
              "amount_cents": number,
"chore_id": string,
"chore_title_snapshot": string,
"created_at": string,
"device_id": string | null,
"household_id": string,
"id": string,
"idempotency_key": string | null,
"kid_id": string,
"photo_path": string | null,
"quantity": number,
"resubmitted_at": string | null,
"review_comment": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string,
"submitted_at": string,
"unit_price_cents": number
            }
                          SetofOptions: {
        from: "*"
        to: "submissions"
        isOneToOne: true
        isSetofReturn: false
      } },
"kiosk_release_claim":
{ Args: { "p_claim_id": string,"p_household_id": string,"p_kid_id": string }; Returns: {
              "chore_id": string,
"claimed_at": string,
"device_id": string | null,
"expires_at": string,
"household_id": string,
"id": string,
"kid_id": string,
"quantity": number,
"release_reason": string | null,
"released_at": string | null,
"submission_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "chore_claims"
        isOneToOne: true
        isSetofReturn: false
      } },
"kiosk_resubmit":
{ Args: { "p_household_id": string,"p_kid_id": string,"p_submission_id": string }; Returns: {
              "amount_cents": number,
"chore_id": string,
"chore_title_snapshot": string,
"created_at": string,
"device_id": string | null,
"household_id": string,
"id": string,
"idempotency_key": string | null,
"kid_id": string,
"photo_path": string | null,
"quantity": number,
"resubmitted_at": string | null,
"review_comment": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string,
"submitted_at": string,
"unit_price_cents": number
            }
                          SetofOptions: {
        from: "*"
        to: "submissions"
        isOneToOne: true
        isSetofReturn: false
      } },
"kiosk_toggle_subtask":
{ Args: { "p_checked": boolean,"p_chore_id": string,"p_device_id": string,"p_household_id": string,"p_kid_id": string,"p_subtask_id": string }; Returns: Json
                           },
"kiosk_withdraw_submission":
{ Args: { "p_household_id": string,"p_kid_id": string,"p_submission_id": string }; Returns: {
              "amount_cents": number,
"chore_id": string,
"chore_title_snapshot": string,
"created_at": string,
"device_id": string | null,
"household_id": string,
"id": string,
"idempotency_key": string | null,
"kid_id": string,
"photo_path": string | null,
"quantity": number,
"resubmitted_at": string | null,
"review_comment": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string,
"submitted_at": string,
"unit_price_cents": number
            }
                          SetofOptions: {
        from: "*"
        to: "submissions"
        isOneToOne: true
        isSetofReturn: false
      } },
"parent_release_claim":
{ Args: { "p_claim_id": string }; Returns: {
              "chore_id": string,
"claimed_at": string,
"device_id": string | null,
"expires_at": string,
"household_id": string,
"id": string,
"kid_id": string,
"quantity": number,
"release_reason": string | null,
"released_at": string | null,
"submission_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "chore_claims"
        isOneToOne: true
        isSetofReturn: false
      } },
"promo_bonus_at":
{ Args: { "p_amount_cents": number,"p_at": string,"p_household_id": string }; Returns: {
              "bonus_cents": number,"name": string,"promotion_id": string
            }[]
                           },
"record_payout":
{ Args: { "p_allow_negative"?: boolean,"p_gross_cents": number,"p_kid_id": string,"p_method": string,"p_note"?: string }; Returns: Json
                           },
"reject_submission":
{ Args: { "p_reason": string,"p_submission_id": string }; Returns: {
              "amount_cents": number,
"chore_id": string,
"chore_title_snapshot": string,
"created_at": string,
"device_id": string | null,
"household_id": string,
"id": string,
"idempotency_key": string | null,
"kid_id": string,
"photo_path": string | null,
"quantity": number,
"resubmitted_at": string | null,
"review_comment": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string,
"submitted_at": string,
"unit_price_cents": number
            }
                          SetofOptions: {
        from: "*"
        to: "submissions"
        isOneToOne: true
        isSetofReturn: false
      } },
"reopen_submission":
{ Args: { "p_comment": string,"p_mode": string,"p_submission_id": string }; Returns: {
              "amount_cents": number,
"chore_id": string,
"chore_title_snapshot": string,
"created_at": string,
"device_id": string | null,
"household_id": string,
"id": string,
"idempotency_key": string | null,
"kid_id": string,
"photo_path": string | null,
"quantity": number,
"resubmitted_at": string | null,
"review_comment": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string,
"submitted_at": string,
"unit_price_cents": number
            }
                          SetofOptions: {
        from: "*"
        to: "submissions"
        isOneToOne: true
        isSetofReturn: false
      } },
"send_back_submission":
{ Args: { "p_comment": string,"p_submission_id": string }; Returns: {
              "amount_cents": number,
"chore_id": string,
"chore_title_snapshot": string,
"created_at": string,
"device_id": string | null,
"household_id": string,
"id": string,
"idempotency_key": string | null,
"kid_id": string,
"photo_path": string | null,
"quantity": number,
"resubmitted_at": string | null,
"review_comment": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string,
"submitted_at": string,
"unit_price_cents": number
            }
                          SetofOptions: {
        from: "*"
        to: "submissions"
        isOneToOne: true
        isSetofReturn: false
      } },
"valid_subtasks":
{ Args: { "p": Json }; Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const


export type GoalId = "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7" | "G8"
export type GoalStatus = "answered" | "partial" | "deferred"
export type SlotClass = "core" | "flex" | "followup"
export type QuestionType =
  | "single_choice"
  | "multi_choice"
  | "number"
  | "short_text"
  | "long_text"
  | "contact_block"
export type Source = "rules" | "starter" | "ai" | "pool" | "time_cap" | "cap"

export interface Option {
  id: number
  label: string
  ordinal?: boolean
  free_text?: boolean
}

export interface ConditionAtom {
  q: string
  op: "eq" | "gte" | "lte" | "in" | "option_gte" | "option_lte" | "includes_any" | "includes_all"
  value: number | number[]
  field?: string
}

export interface ConditionAny {
  any: Condition[]
}
export interface ConditionAll {
  all: Condition[]
}
export interface ConditionNot {
  not: Condition
}
export type Condition = ConditionAtom | ConditionAny | ConditionAll | ConditionNot

export interface Rule {
  rule_id: string
  priority: number
  depth: number
  doc_order: number
  condition: Condition
  then: string
}

export interface CommentField {
  label: string
  type?: string
  required?: boolean
  counts_as_question?: boolean
}

export interface NumberField {
  key: string
  integer?: boolean
  min?: number
  max?: number
}

export interface Question {
  id: string
  text: string
  type: QuestionType
  options: Option[]
  goal: GoalId
  required?: boolean
  industry_tags: string[]
  slot: number | null
  slot_class: SlotClass
  replaces?: string
  followups: Rule[]
  max_selections?: number
  validation?: { integer?: boolean; min?: number; max?: number; min_chars?: number; max_chars?: number }
  comment_field?: CommentField
  number_fields?: NumberField[]
  sizing_only?: boolean
  pool?: boolean
  fallback?: boolean
  free_text_notice?: string
  options_apply_to?: string
}

export interface QBank {
  spec_version: string
  limits: {
    max_questions: number
    max_followups: number
    max_chain_depth: number
    time_cap_ms: number
  }
  core_slots: number[]
  flex_slots_drop_order: number[]
  on_no_budget: string
  industry_map: Record<string, string>
  goals: Record<GoalId, string>
  medical_free_text_notice: string
  notes?: string[]
  questions: Question[]
}

export interface TraceItem {
  id: string
  source: Source
  ruleId?: string
}

export interface PrefetchHint {
  partialKey: string
  questionId: string
  done: boolean
  source: Source
}

export interface InterviewState {
  industry: string
  answers: Record<string, unknown>
  comments: Record<string, string>
  askedOrder: string[]
  droppedSlots: number[]
  followupsAsked: string[]
  followupsSkipped: string[]
  startedAt: number
  currentQuestionId: string | null
  completed: boolean
  endReason: "time_cap" | "cap" | "complete" | null
  trace: TraceItem[]
  redacted: boolean
  goalStatus: Record<string, GoalStatus>
  prefetch: PrefetchHint | null
}

export interface ContactAnswer {
  full_name: string
  business_name: string
  role?: string
  email: string
  phone?: string
  website?: string
  best_time: number
  timezone?: string
}

export interface OutputRecord {
  answers: Record<string, unknown>
  comments: Record<string, string>
  industry_tag: string
  asked_order: string[]
  dropped_slots: number[]
  followups_asked: string[]
  followups_skipped: string[]
  goal_status: Record<string, GoalStatus>
}

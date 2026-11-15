import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
}) : null;

export type Role = "worker" | "company";
export type SwipeDirection = "left" | "right" | "super";

export type Profile = {
  id: string; role: Role | null; enabled_roles: Role[]; display_name: string; city: string; lat: number | null; lng: number | null; avatar_path: string | null; onboarding_complete: boolean;
  avatar_url: string | null; full_name: string; birth_year: number | null; experience_years: number;
  has_driving_license: boolean; has_own_vehicle: boolean; languages: string[]; default_bio: string; default_audio_url: string | null;
  cv_url: string | null; cv_filename: string | null;
  company_name: string; company_logo_url: string | null; company_sector: string; company_address: string; company_description: string;
  company_phone: string; show_phone_on_match: boolean;
};
export type WorkerCard = { id: string; user_id: string | null; full_name: string; age: number | null; photo_path: string | null; desired_position: string; sector: string; experience_years: number; availability: string; availability_note: string; skills: string[]; bio: string; city: string; lat: number; lng: number; intro_audio_path: string | null; cv_url: string | null; cv_filename: string | null; is_featured: boolean; is_demo: boolean };
export type JobOffer = { id: string; company_id: string | null; business_name: string; business_image_path: string | null; position: string; sector: string; salary_text: string; salary_amount: number | null; salary_frequency: "mensual" | "hora" | "jornada"; salary_kind: "neto" | "bruto"; salary_min: number | null; salary_max: number | null; salary_period: string; shift_type: string; schedule: string; benefits: string[]; description: string; city: string; address_approx: string; lat: number; lng: number; expires_at: string; is_active: boolean; is_demo: boolean };
export type Match = { id: string; worker_id: string; company_id: string; worker_card_id: string; job_offer_id: string; created_at: string; last_read_at_worker: string | null; last_read_at_company: string | null; other_name?: string; other_photo?: string | null; position?: string; preview?: string; preview_at?: string; unread?: boolean };
export type Message = { id: string; match_id: string; sender_id: string; body: string; created_at: string; message_type: "text" | "interview" | "interview_reply"; metadata: Record<string, unknown>; read_at: string | null };

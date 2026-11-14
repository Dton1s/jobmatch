import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
}) : null;

export type Role = "worker" | "company";
export type SwipeDirection = "left" | "right" | "super";

export type Profile = { id: string; role: Role | null; display_name: string; city: string; lat: number | null; lng: number | null; avatar_path: string | null; onboarding_complete: boolean };
export type WorkerCard = { id: string; user_id: string; full_name: string; photo_path: string | null; desired_position: string; sector: string; experience_years: number; availability: string; skills: string[]; city: string; lat: number; lng: number; intro_audio_path: string | null; is_featured: boolean };
export type JobOffer = { id: string; company_id: string; business_name: string; business_image_path: string | null; position: string; sector: string; salary_text: string; salary_min: number | null; salary_max: number | null; salary_period: string; shift_type: string; description: string; city: string; lat: number; lng: number; expires_at: string };
export type Match = { id: string; worker_id: string; company_id: string; worker_card_id: string; job_offer_id: string; created_at: string };

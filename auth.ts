
import { Session, User } from '@supabase/supabase-js';

export type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  profile?: UserProfile | null;
  subscription?: UserSubscription | null;
  referralCode?: string | null;
}

export type UserProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export type UserSubscription = {
  id: string;
  plan_id: number;
  plan_name?: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
}

export type UserPreferences = {
  id: string;
  theme: string | null;
  notifications: boolean | null;
  demo_mode_enabled?: boolean | null;
  dark_mode_enabled?: boolean | null;
  email_notifications_enabled?: boolean | null;
}

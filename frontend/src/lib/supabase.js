import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Auth helpers ──────────────────────────────────────────────

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });

export const signUp = (email, password, fullName, phone) =>
  supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, phone } }
  });

export const signOut = () => supabase.auth.signOut();

export const getSession = () => supabase.auth.getSession();

// ── File upload helpers ───────────────────────────────────────

export const uploadKycDoc = async (tenantId, docType, file) => {
  const ext = file.name.split('.').pop();
  const path = `${tenantId}/${docType}_${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('kyc-documents')
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('kyc-documents')
    .getPublicUrl(path);

  return { path: data.path, url: publicUrl };
};

export const uploadMaintenancePhoto = async (ticketId, file) => {
  const ext = file.name.split('.').pop();
  const path = `${ticketId}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('maintenance')
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('maintenance')
    .getPublicUrl(path);

  return { path: data.path, url: publicUrl };
};

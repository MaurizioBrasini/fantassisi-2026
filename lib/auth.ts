import { supabase } from "./supabase";

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function isAdmin() {
  const user = await getCurrentUser();
  if (!user) return false;
  const { data } = await supabase
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .single();
  return !!data;
}
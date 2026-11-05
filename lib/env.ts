/** Feature switches derived from env. Missing keys put that integration in demo mode. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
};

export const isSupabaseConfigured = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const isDemoMode = () => !isSupabaseConfigured();
export const isStripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY && (process.env.STRIPE_PRICE_INVESTOR || process.env.STRIPE_PRICE_PRO_MONTHLY));
export const isAnthropicConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

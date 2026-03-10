export interface Company {
  id: string;
  name: string;
  business_type: string;
  current_plan: string;
  target_markets: string[] | null;
}

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  company_id?: string | null;
  user_type?: "b2b" | "b2c" | "admin";
  company_role?: "root" | "member" | "viewer";
  is_root?: boolean;
  avatar_url?: string | null;
}

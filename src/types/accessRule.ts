export type AccessRule = {
  id: string;
  page_key: string;
  role: "free" | "premium" | "admin";
  access_level: "none" | "preview" | "full";
  updated_at: string;
};

export type EmailRow = {
  external_id: string;
  name: string;
  published_at: string | null;
  send_emails: boolean;
  shown_on_profile: boolean;
  installment_type: string;
  full_url: string | null;
  has_been_blasted: boolean;
  sent_count: number | null;
  open_count: number | null;
  click_count: number | null;
  view_count: number | null;
  open_rate: number | null;
  click_rate: number | null;
};

export type EmailsListResponse = {
  installments: EmailRow[];
  pagination: { count: number; next: number | null };
  has_posts: boolean;
};

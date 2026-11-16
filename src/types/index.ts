export interface Gym {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  logo_url: string | null;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  currency: string;
  status: "active" | "trial" | "suspended" | "cancelled";
  plan: "presencia" | "reservas" | "negocio" | "app_pro" | "centro_deportivo" | "enterprise";
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  gym_id: string;
  name: string;
  email: string;
  phone: string;
  tariff: string;
  tariff_id: string | null;
  status: "active" | "pending" | "inactive" | "blocked";
  join_date: string;
  notes: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  gym_id: string;
  name: string;
  type: "dinamico" | "premium" | "salud" | "personal_1h" | "personal_30min";
  instructor: string;
  instructor_id: string | null;
  max_spots: number;
  booked_spots: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  gym_id: string;
  member_id: string;
  member_name: string;
  amount: number;
  description: string;
  method: "manual" | "sepa" | "card" | "stripe" | "cash";
  status: "pending" | "completed" | "failed" | "cancelled";
  date: string;
  period: string;
  created_at: string;
  updated_at: string;
}

export interface Tariff {
  id: string;
  gym_id: string;
  group: string;
  name: string;
  price: number;
  type: "monthly" | "bonus";
  sessions_per_week: number | null;
  total_sessions: number | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  gym_id: string;
  class_id: string;
  member_id: string;
  date: string;
  status: "confirmed" | "cancelled" | "attended" | "no_show";
  created_at: string;
}

export interface Instructor {
  id: string;
  gym_id: string;
  name: string;
  email: string;
  phone: string;
  specialties: string[];
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  gym_id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  is_read: boolean;
  created_at: string;
}

export interface DashboardKPI {
  active_members: number;
  total_members: number;
  monthly_revenue: number;
  average_ticket: number;
  churn_rate: number;
}

export interface UpcomingClass {
  id: string;
  name: string;
  type: Class["type"];
  instructor: string;
  start_time: string;
  end_time: string;
  booked: number;
  max_spots: number;
}

export interface RevenueMonth {
  month: string;
  amount: number;
}

export interface TariffDistribution {
  name: string;
  percentage: number;
  color: string;
}

export type NavSection = {
  title: string;
  items: NavItem[];
};

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  badge?: string | number;
};

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'
  | null

export interface MemberDashboardData {
  memberId: string
  gymId: string
  fullName: string
  email: string
  phone: string | null
  memberStatus: string
  tariffName: string | null
  tariffAmount: number | null
  tariffType: string | null
  stripePriceId: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: SubscriptionStatus
  subscriptionCurrentPeriodEnd: string | null
  gymName: string
  gymPaymentMode: string
  stripeOnboarded: boolean
  recentPayments: MemberPayment[]
}

export interface MemberPayment {
  id: string
  amount: number
  currency: string
  status: string
  paidAt: string | null
  createdAt: string
  description: string | null
  paymentSource: string
  stripeInvoiceId: string | null
}

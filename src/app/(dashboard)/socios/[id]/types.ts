// Tipos puros (sin server-only) compartidos entre Server Component y Client.

export interface MemberDetail {
  id: string
  gymId: string
  firstName: string
  lastName: string
  secondLastName: string | null
  email: string | null
  phone: string | null
  birthDate: string | null
  gender: string | null
  taxId: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  joinDate: string
  leaveDate: string | null
  status: 'active' | 'pending' | 'inactive' | 'blocked'
  avatarUrl: string | null
  notes: string | null
  internalNotes: string | null
  medicalNotes: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelation: string | null
  currentTariffId: string | null
  currentTariffName: string | null
  currentTariffPrice: number | null
  currentTariffNextChargeAt: string | null
  authUserId: string | null
  blockedForMorososAt: string | null
}

export interface TariffOption {
  id: string
  name: string
  group: string | null
}

export interface MemberTariffHistoryRow {
  id: string
  tariffId: string | null
  tariffName: string
  startsAt: string | null
  endsAt: string | null
  status: string
  amount: number | null
}

export interface BookingHistoryRow {
  id: string
  classInstanceId: string
  className: string
  startAt: string
  status: string
  attended: boolean
}

export interface PaymentHistoryRow {
  id: string
  description: string | null
  concept: string | null
  amount: number
  currency: string
  status: string
  method: string | null
  dueDate: string | null
  paidAt: string | null
  createdAt: string
}

export interface RecurringBookingRow {
  id: string
  type: 'class' | 'appointment'
  classId: string | null
  className: string | null
  instructorId: string | null
  instructorName: string | null
  room: string | null
  durationMinutes: number | null
  dayOfWeek: number
  startTime: string
  startsOn: string
  endsOn: string | null
  active: boolean
  notes: string | null
}

export interface AttendanceStats {
  reservedTotal: number
  attendedTotal: number
  cancelledTotal: number
  noShowTotal: number
  attendanceRate: number // 0..1
  last30Reserved: number
  last30Attended: number
}

export interface ClassOption {
  id: string
  name: string
  defaultDuration: number | null
}

export interface InstructorOption {
  id: string
  name: string
}

export interface MemberClauseRow {
  id: string
  templateId: string | null
  titleSnapshot: string
  bodySnapshot: string
  status: 'pending' | 'signed' | 'rejected' | 'expired'
  signedAt: string | null
  signedByName: string | null
  assignedAt: string
  expiresAt: string | null
}

export interface ClauseTemplateOption {
  id: string
  code: string
  title: string
  body: string
  isRequired: boolean
}


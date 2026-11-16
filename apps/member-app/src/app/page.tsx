import { redirect } from 'next/navigation'

// El middleware ya enruta: si auth → /inicio, si no auth → /login.
// Esta página es solo fallback por si llega aquí (edge case).
export default function HomePage() {
  redirect('/login')
}

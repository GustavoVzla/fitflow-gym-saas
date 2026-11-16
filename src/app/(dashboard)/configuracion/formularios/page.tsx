import FormulariosClient from './FormulariosClient'
import { getFormFields } from './data'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const fields = await getFormFields()
  return <FormulariosClient initialFields={fields} />
}

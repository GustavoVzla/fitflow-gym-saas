import fs from 'node:fs/promises'
import path from 'node:path'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  filename: string
}

/**
 * Server Component — lee MD de `content/legal/` en build/request time.
 * Cero JS client-side. Rendering con prose classes del layout parent.
 */
export async function MarkdownRenderer({ filename }: Props) {
  const filepath = path.join(process.cwd(), 'content/legal', filename)
  const source = await fs.readFile(filepath, 'utf-8')
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
}

import ReactMarkdown from 'react-markdown'

const components = {
  h1: ({ children }) => <p className="font-bold text-lg mt-2 mb-1">{children}</p>,
  h2: ({ children }) => <p className="font-bold mt-2 mb-1">{children}</p>,
  h3: ({ children }) => <p className="font-semibold mt-1 mb-1">{children}</p>,
  p:  ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => <code className="font-mono text-sm bg-black/5 px-1 rounded">{children}</code>,
}

export function MarkdownMessage({ children }) {
  return (
    <ReactMarkdown components={components}>
      {children}
    </ReactMarkdown>
  )
}

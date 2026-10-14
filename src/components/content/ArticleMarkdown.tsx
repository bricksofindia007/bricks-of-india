import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Article bodies with GitHub-flavoured markdown (tables), 2 Oct 2026: the Brick Rush
// list article's 50-row table rendered as raw "| ... |" text without it. Wide tables
// scroll sideways on phones instead of stretching the page.
export function ArticleMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children }) => (
          <div className="overflow-x-auto -mx-4 px-4">
            <table>{children}</table>
          </div>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

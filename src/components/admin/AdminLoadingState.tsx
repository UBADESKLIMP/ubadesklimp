interface AdminLoadingStateProps {
  label?: string;
  rows?: number;
  tone?: 'dark' | 'light';
}

const AdminLoadingState = ({ label = 'Carregando...', rows = 4, tone = 'dark' }: AdminLoadingStateProps) => {
  const isLight = tone === 'light';
  return (
    <div className="py-8 space-y-3" role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={
            isLight
              ? 'h-16 rounded-lg bg-muted border border-border animate-pulse'
              : 'h-16 rounded-lg bg-blue-500/5 border border-blue-500/10 animate-pulse'
          }
        />
      ))}
    </div>
  );
};

export default AdminLoadingState;

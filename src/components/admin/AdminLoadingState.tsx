interface AdminLoadingStateProps {
  label?: string;
  rows?: number;
}

const AdminLoadingState = ({ label = 'Carregando...', rows = 4 }: AdminLoadingStateProps) => {
  return (
    <div className="py-8 space-y-3" role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-16 rounded-lg bg-blue-500/5 border border-blue-500/10 animate-pulse"
        />
      ))}
    </div>
  );
};

export default AdminLoadingState;

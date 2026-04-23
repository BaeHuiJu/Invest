type StatCardProps = {
  label: string;
  value: string;
  accent?: string;
};

export function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <div className="rounded-xl border border-c-border bg-c-surface p-4 shadow-sm">
      <div className="text-sm text-c-text-2">{label}</div>
      <div className={`text-2xl font-bold ${accent || 'text-c-text'}`}>{value}</div>
    </div>
  );
}

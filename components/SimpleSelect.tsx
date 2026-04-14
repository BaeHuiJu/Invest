type SimpleSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
};

export function SimpleSelect({ label, value, onChange, options }: SimpleSelectProps) {
  return (
    <div className="w-full sm:w-auto">
      <label className="mb-1 block text-sm text-gray-500">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm sm:min-w-[140px]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

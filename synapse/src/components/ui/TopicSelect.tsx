import type { ID, Topic } from '../../types';

export function TopicSelect({
  topics,
  value,
  onChange,
  placeholder = 'Choose a concept…',
  className = ''
}: {
  topics: Topic[];
  value: ID | null;
  onChange: (id: ID) => void;
  placeholder?: string;
  className?: string;
}) {
  const domains = [...new Set(topics.map((t) => t.domain))].sort();
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`input cursor-pointer ${className}`}>
      <option value="" disabled>
        {placeholder}
      </option>
      {domains.map((d) => (
        <optgroup key={d} label={d}>
          {topics
            .filter((t) => t.domain === d)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

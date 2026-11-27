const styles: Record<string, string> = {
  excellent: "bg-emerald-100 text-emerald-800",
  good: "bg-teal-100 text-teal-800",
  fair: "bg-amber-100 text-amber-800",
  poor: "bg-orange-100 text-orange-800",
  damaged: "bg-red-100 text-red-800",
};

export function conditionClass(c: string) {
  return styles[c] ?? "bg-stone-100 text-stone-700";
}

export default function ConditionBadge({ condition }: { condition: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${conditionClass(condition)}`}>{condition}</span>
  );
}

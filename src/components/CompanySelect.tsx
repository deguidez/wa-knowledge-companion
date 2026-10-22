import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { companies, companyLabels, type Company } from '@/lib/company-flow';

export function CompanySelect({ value, onChange, label = 'Empresa' }: { value: Company; onChange: (company: Company) => void; label?: string }) {
  return <Select value={value} onValueChange={(v) => { if (v === 'association' || v === 'events') onChange(v); }}>
    <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
    <SelectContent>{companies.map((c) => <SelectItem key={c} value={c}>{companyLabels[c]}</SelectItem>)}</SelectContent>
  </Select>;
}
import type { Disponibilidade } from '../lib/types'

const OPTIONS: { key: keyof Disponibilidade; label: string }[] = [
  { key: 'hoje', label: 'Disponível hoje' },
  { key: 'amanha', label: 'Disponível amanhã' },
  { key: 'estaSemana', label: 'Esta semana' },
  { key: 'finaisDeSemana', label: 'Finais de semana' },
  { key: 'noturno', label: 'Noturno' },
  { key: 'viagens', label: 'Viagens' },
  { key: 'temporario', label: 'Trabalho temporário' },
  // Faltava aqui: o cadastro começa com freelancer ligado e, sem o botão, não dava para desligar —
  // a pessoa seguia recebendo convites mesmo desmarcando tudo.
  { key: 'freelancer', label: 'Freelancer (missões avulsas)' },
  { key: 'efetivo', label: 'Efetivo' },
]

type Props = {
  value: Disponibilidade
  onChange: (next: Disponibilidade) => void
}

export function AvailabilityToggle({ value, onChange }: Props) {
  return (
    <div className="availability-grid">
      {OPTIONS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={`availability-chip ${value[key] ? 'availability-chip--on' : ''}`}
          onClick={() => onChange({ ...value, [key]: !value[key] })}
        >
          <span className="availability-dot" />
          {label}
        </button>
      ))}
    </div>
  )
}

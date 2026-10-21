export type Tab = 'today' | 'activities' | 'profile';

const TABS: [Tab, string][] = [['today', 'Hoje'], ['activities', 'Atividades'], ['profile', 'Perfil']];

export function TabBar({ current, onChange }: { current: Tab; onChange: (t: Tab) => void }) {
  return (
    <div role="tablist" className="tabbar">
      {TABS.map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={current === id} className="tabbar-tab" onClick={() => onChange(id)}>
          <span className="tabbar-bar" />
          {label}
        </button>
      ))}
    </div>
  );
}

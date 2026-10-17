import './ui.css';

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={value === t.value}
            className={`tabs__tab${value === t.value ? ' is-active' : ''}`}
            onClick={() => onChange(t.value)}
          >
            {Icon && <Icon size={15} aria-hidden="true" />}
            {t.label}
            {t.count != null && <span className="tabs__count">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

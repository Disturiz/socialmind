export function Input({ label, error, id, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={id} className="font-semibold text-text-primary text-sm">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`
          w-full border-2 rounded-2xl px-4 py-3 text-base text-text-primary bg-calm-surface
          focus:outline-none transition-colors min-h-[56px]
          ${error
            ? 'border-accent-coral focus:border-accent-coral'
            : 'border-calm-border focus:border-primary-500'
          }
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-accent-coral text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

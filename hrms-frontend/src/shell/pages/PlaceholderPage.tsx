export function ModulePlaceholder({ heading }: { heading: string }) {
  return (
    <section className="rounded-[0.85rem] p-[1.25rem_1.35rem] [background:var(--app-surface)] [border:1px_solid_var(--app-border)]" aria-label={heading}>
      <h2 className="m-[0_0_0.5rem]">{heading}</h2>
      <p className="m-0 leading-[1.5] text-[color:var(--app-text-muted)]">
        This module is not mounted in the preview host yet. Use Dashboard,
        Company, Clients, Vendors, Billing, Payrolls, Revenue, Projects,
        Employees, Timesheets, Leaves, or Schedule to continue.
      </p>
    </section>
  );
}

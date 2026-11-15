import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}

/** Standard page header: title + one-line description + optional actions. */
const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions, meta }) => (
  <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
    <div className="min-w-0">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;

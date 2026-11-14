import type React from 'react';

export interface MessageProps {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}

/** A calm, centred explanation used when there is nothing to draw. */
export const Message: React.FC<MessageProps> = ({
  icon,
  title,
  children,
  action,
}) => (
  <div className="flex-1 min-h-0 min-w-0 rounded-3xl bg-wash flex items-center justify-center p-10">
    <div className="max-w-sm flex flex-col items-center gap-4 text-center">
      <span className="text-ink-3">{icon}</span>
      <h2 className="m-0 text-ui-title text-ink">{title}</h2>
      {children ? (
        <p className="m-0 text-ink-3 break-words">{children}</p>
      ) : null}
      {action}
    </div>
  </div>
);

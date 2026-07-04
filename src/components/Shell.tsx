/** Centered page column, content capped at 1040px. */
export function Shell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto flex w-full max-w-[1040px] flex-1 flex-col${
        className ? ` ${className}` : ""
      }`}
    >
      {children}
    </div>
  );
}

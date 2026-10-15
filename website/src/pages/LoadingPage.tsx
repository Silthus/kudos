export function LoadingPage() {
  return (
    <div aria-hidden="true" data-loading-placeholder className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <Bar className="h-9 w-44" />
        <div className="flex flex-col gap-3 py-4">
          <Bar className="h-3 w-20" />
          <Bar className="h-9 w-64 max-w-full" />
          <Bar className="h-4 w-full max-w-xl" />
          <Bar className="mt-1 h-10 w-52" />
        </div>
        <Card className="h-36" />
      </div>
      <div className="hidden flex-col gap-6 lg:flex">
        <Card className="h-64" />
        <Card className="h-48" />
      </div>
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return <div className={`rounded-md bg-muted ${className}`} />;
}

function Card({ className }: { className: string }) {
  return <div className={`rounded-lg border bg-card ${className}`} />;
}

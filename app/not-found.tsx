import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        We could not find the page you are looking for.
      </p>
      <Link
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Back to home
      </Link>
    </div>
  );
}

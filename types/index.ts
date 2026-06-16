// Shared Next.js page types
export interface PageProps {
  params?: Record<string, string | string[]>;
  searchParams?: Record<string, string | string[]>;
  children?: React.ReactNode;
}

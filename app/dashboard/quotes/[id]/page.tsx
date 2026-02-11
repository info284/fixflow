import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;

  redirect(`/dashboard/estimates?quoteId=${encodeURIComponent(id)}`);
}
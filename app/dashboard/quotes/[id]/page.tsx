import { redirect } from "next/navigation";

interface PageProps {
  params: {
    id: string;
  };
}

export default async function Page({ params }: PageProps) {
const id = params?.id || "";
redirect(`/dashboard/estimates?quoteId=${encodeURIComponent(id)}`);
}
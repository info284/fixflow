import QuoteClient from "./QuoteClient";

export default async function Page({
params,
}: {
params: Promise<{ slug: string }>;
}) {
const { slug } = await params; // Next 15: params is a Promise
return <QuoteClient slug={slug} />;
}
import ReviewForm from "./ReviewForm";

export default function ReviewPage({
  params,
}: {
  params: { token: string };
}) {
  return <ReviewForm token={params.token} />;
}
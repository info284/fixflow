import { redirect } from "next/navigation";

export default function QuotesRedirect() {
  redirect("/dashboard/estimates");
}
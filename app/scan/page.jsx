import { redirect } from "next/navigation";

export default async function ScanPage({ searchParams }) {
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : "";

  if (error) {
    redirect(`/?error=${encodeURIComponent(error)}#scan`);
  }

  redirect("/#scan");
}

import { redirect } from "next/navigation";

/** Old Leaves URLs: leave requests and approvals now live in Employee Portal. */
export default async function LeavesRedirectPage({
  params,
}: {
  params: Promise<{ rest?: string[] }>;
}) {
  const { rest = [] } = await params;
  if (rest[0] === "approvals") {
    redirect("/employee-portal/manage");
  }
  redirect("/employee-portal");
}

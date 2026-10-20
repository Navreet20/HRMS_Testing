import { redirect } from "next/navigation";

export default async function AttendanceRedirectPage({
  params,
}: {
  params: Promise<{ rest?: string[] }>;
}) {
  const { rest = [] } = await params;
  const tail = rest[0];
  if (tail === "approvals" || tail === "employees") {
    redirect("/employee-portal/manage");
  }
  redirect("/timesheets");
}

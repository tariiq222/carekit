import { redirect } from "next/navigation"

export default function DepartmentsRoute() {
  redirect("/services?tab=departments")
}

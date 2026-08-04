import { redirect } from "next/navigation";

export default function PracticeAssignmentsPage() {
  redirect("/practice/profile?tab=tasks");
}

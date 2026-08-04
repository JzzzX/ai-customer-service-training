import { redirect } from "next/navigation";

export default function PracticeHistoryPage() {
  redirect("/practice/profile?tab=quiz");
}

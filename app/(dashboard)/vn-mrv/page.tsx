import { redirect } from "next/navigation";

// Đường dẫn cũ — tính năng đã gộp vào /vietnam-carbon (một trang duy nhất cho mỗi tính năng).
export default function LegacyRedirect() {
  redirect("/vietnam-carbon");
}

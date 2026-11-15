import { redirect } from "next/navigation";

// Đường dẫn cũ — tính năng đã gộp vào /demo/connected-data (một trang duy nhất cho mỗi tính năng).
export default function LegacyRedirect() {
  redirect("/demo/connected-data");
}

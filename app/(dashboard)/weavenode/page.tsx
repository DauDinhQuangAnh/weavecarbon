import { redirect } from "next/navigation";

// Đường dẫn cũ — tính năng đã gộp vào /connected-data (một trang duy nhất cho mỗi tính năng).
export default function LegacyRedirect() {
  redirect("/connected-data");
}

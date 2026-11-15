import { redirect } from "next/navigation";

// Đường dẫn cũ — tính năng đã gộp vào /data-quality (một trang duy nhất cho mỗi tính năng).
export default function LegacyRedirect() {
  redirect("/data-quality");
}

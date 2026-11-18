import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { SALES_CONTACT } from "@/lib/pricing/plans";

export const metadata: Metadata = {
  title: "Chính sách bảo mật | WeaveCarbon",
  description: "Chính sách bảo vệ dữ liệu cá nhân của WeaveCarbon (bản nháp).",
  robots: { index: false }
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Chính sách bảo mật">
      <p>
        Chính sách này mô tả cách WeaveCarbon xử lý dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP về
        bảo vệ dữ liệu cá nhân. Bên Kiểm soát và xử lý dữ liệu: [Tên pháp nhân / địa chỉ, cần bổ sung].
      </p>
      <section>
        <h2>1. Dữ liệu chúng tôi thu thập</h2>
        <ul>
          <li>Thông tin tài khoản: họ tên, email, mật khẩu (lưu dạng băm), vai trò, doanh nghiệp.</li>
          <li>Dữ liệu doanh nghiệp: sản phẩm, cơ sở, dữ liệu hoạt động, lô hàng, chứng từ (hoá đơn, phiếu cân…) do bạn tải lên.</li>
          <li>Dữ liệu thiết bị WeaveNode (nếu sử dụng): số đo, thời gian, mã thiết bị.</li>
          <li>Dữ liệu kỹ thuật: địa chỉ IP, nhật ký truy cập, thông tin trình duyệt; dữ liệu phiên lưu trong trình duyệt (sessionStorage/localStorage) để duy trì đăng nhập và tuỳ chọn ngôn ngữ.</li>
          <li>Thông tin thanh toán do VNPAY xử lý; WeaveCarbon không lưu số thẻ.</li>
        </ul>
      </section>
      <section>
        <h2>2. Mục đích xử lý</h2>
        <ul>
          <li>Cung cấp dịch vụ: tính toán, lưu bằng chứng, tạo báo cáo, audit trail.</li>
          <li>Xác thực, bảo mật, phòng chống lạm dụng; thanh toán và chăm sóc khách hàng.</li>
          <li>Cải thiện sản phẩm dựa trên số liệu sử dụng đã tổng hợp.</li>
        </ul>
      </section>
      <section>
        <h2>3. Bên thứ ba và chuyển dữ liệu ra nước ngoài</h2>
        <ul>
          <li><strong>VNPAY</strong>: xử lý thanh toán.</li>
          <li><strong>Google</strong>: đăng nhập bằng Google (nếu bạn chọn), và dịch vụ AI Gemini dùng để đọc chứng từ bạn tải lên khi bạn dùng tính năng trích xuất tự động. Dữ liệu này có thể được xử lý ở ngoài Việt Nam. [Hồ sơ đánh giá tác động chuyển dữ liệu ra nước ngoài: cần bổ sung.]</li>
          <li>Nhà cung cấp hạ tầng máy chủ: [cần bổ sung].</li>
        </ul>
        <p>Chúng tôi không bán dữ liệu cá nhân.</p>
      </section>
      <section>
        <h2>4. Thời gian lưu trữ</h2>
        <p>
          Dữ liệu tài khoản được lưu trong thời gian bạn sử dụng dịch vụ. Tài khoản demo được xoá tự động
          sau khi hết hạn. Chứng từ và bản ghi kiểm toán được lưu theo yêu cầu truy vết của báo cáo.
          [Thời hạn cụ thể: cần bổ sung.]
        </p>
      </section>
      <section>
        <h2>5. Quyền của bạn</h2>
        <p>
          Theo Nghị định 13/2023/NĐ-CP, bạn có quyền được biết, đồng ý hoặc rút lại sự đồng ý, truy cập,
          chỉnh sửa, xoá, hạn chế xử lý, nhận dữ liệu, phản đối xử lý, khiếu nại và yêu cầu bồi thường.
          Gửi yêu cầu tới {SALES_CONTACT.email}.
        </p>
      </section>
      <section>
        <h2>6. Bảo mật</h2>
        <p>
          Kết nối được mã hoá (HTTPS), mật khẩu được băm, hỗ trợ xác thực hai lớp (MFA), phân quyền theo
          doanh nghiệp và ghi nhật ký kiểm toán. Không hệ thống nào an toàn tuyệt đối; khi có sự cố,
          chúng tôi sẽ thông báo theo quy định.
        </p>
      </section>
      <section>
        <h2>7. Liên hệ</h2>
        <p>
          {SALES_CONTACT.email} · {SALES_CONTACT.phoneDisplay}. Xem thêm{" "}
          <Link href="/terms">Điều khoản sử dụng</Link>.
        </p>
      </section>
    </LegalPage>
  );
}

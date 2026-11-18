import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { SALES_CONTACT } from "@/lib/pricing/plans";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng | WeaveCarbon",
  description: "Điều khoản sử dụng nền tảng WeaveCarbon (bản nháp).",
  robots: { index: false }
};

export default function TermsPage() {
  return (
    <LegalPage title="Điều khoản sử dụng">
      <section>
        <h2>1. Về dịch vụ</h2>
        <p>
          WeaveCarbon là nền tảng phần mềm giúp doanh nghiệp thu thập, chuẩn hoá, gắn bằng chứng và
          tính toán dữ liệu phát thải khí nhà kính (KNK), phục vụ kiểm kê nội địa, carbon sản phẩm và
          chuẩn bị hồ sơ xuất khẩu. Đơn vị vận hành: [Tên pháp nhân / địa chỉ, cần bổ sung].
        </p>
      </section>
      <section>
        <h2>2. Tính chất của kết quả</h2>
        <ul>
          <li>Kết quả là ước tính phục vụ ra quyết định và chuẩn bị tiền kiểm toán, theo phương pháp attributional, chỉ tính tác động khí hậu.</li>
          <li>WeaveCarbon <strong>không</strong> thay thế đơn vị thẩm định độc lập và <strong>không</strong> cấp chứng nhận, nhãn sản phẩm, hạn ngạch hay tín chỉ carbon. File xuất ra không phải tờ khai hải quan hay văn bản được cơ quan nhà nước chấp thuận.</li>
          <li>Dữ liệu và kết quả trong chế độ demo là dữ liệu mẫu, không dùng để nộp cho buyer, kiểm toán viên hay cơ quan quản lý.</li>
        </ul>
      </section>
      <section>
        <h2>3. Tài khoản và trách nhiệm của người dùng</h2>
        <ul>
          <li>Bạn chịu trách nhiệm về tính chính xác của dữ liệu và chứng từ tải lên, và bảo đảm có quyền sử dụng chúng.</li>
          <li>Giữ bí mật thông tin đăng nhập; thông báo ngay cho chúng tôi khi nghi ngờ tài khoản bị truy cập trái phép.</li>
          <li>Không dùng dịch vụ để tạo hồ sơ, tuyên bố môi trường hay báo cáo sai sự thật.</li>
        </ul>
      </section>
      <section>
        <h2>4. Gói dịch vụ và thanh toán</h2>
        <p>
          Giá và quyền lợi từng gói được công bố tại trang <Link href="/#pricing">Gói dịch vụ</Link>.
          Thanh toán trực tuyến qua cổng VNPAY; mỗi kỳ thanh toán có thời hạn 30 ngày. Gói Pro và
          Enterprise được kích hoạt qua đội tư vấn. Chính sách hoàn tiền: [cần bổ sung].
        </p>
      </section>
      <section>
        <h2>5. Quyền sở hữu</h2>
        <p>
          Dữ liệu doanh nghiệp bạn nhập vào thuộc về bạn. Phần mềm, giao diện, phương pháp tính và
          tài liệu của WeaveCarbon thuộc về đơn vị vận hành. Các hệ số phát thải của bên thứ ba
          (DEFRA, Ecoinvent, IPCC, Bộ TN&amp;MT…) thuộc quyền của chủ sở hữu tương ứng.
        </p>
      </section>
      <section>
        <h2>6. Giới hạn trách nhiệm</h2>
        <p>
          Trong phạm vi pháp luật cho phép, WeaveCarbon không chịu trách nhiệm cho thiệt hại phát sinh
          từ việc sử dụng kết quả ước tính thay cho kết quả đã được thẩm định độc lập. [Mức giới hạn
          cụ thể: cần bổ sung.]
        </p>
      </section>
      <section>
        <h2>7. Bảo vệ dữ liệu cá nhân</h2>
        <p>
          Việc xử lý dữ liệu cá nhân tuân theo <Link href="/privacy">Chính sách bảo mật</Link>.
        </p>
      </section>
      <section>
        <h2>8. Luật áp dụng và liên hệ</h2>
        <p>
          Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Liên hệ: {SALES_CONTACT.email} ·{" "}
          {SALES_CONTACT.phoneDisplay}.
        </p>
      </section>
    </LegalPage>
  );
}

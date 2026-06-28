export default async function handler(req, res) {
  // Bật CORS để cho phép Chromium gọi API thoải mái
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Xử lý preflight request (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { path } = req.query; // Đường dẫn gốc (ví dụ: /api/login)
  
  // Log request để bạn có thể xem trên Vercel Dashboard
  console.log(`[AUTH INTERCEPT] Path: ${path}, Method: ${req.method}`);
  console.log(`[AUTH INTERCEPT] Body:`, req.body);

  // GIẢ LẬP ĐĂNG NHẬP THÀNH CÔNG (Mock Response)
  // Vì chúng ta chưa biết cấu trúc trả về chính xác của server tainguyenweb.com,
  // tôi thiết lập một cấu trúc JSON phổ biến nhất để báo hiệu "Thành công".
  
  const mockResponse = {
    status: 200,
    success: true,
    message: "Login successful",
    token: "kinx-auto-premium-token-bypass-2099",
    data: {
      id: 1,
      email: req.body?.email || "admin@kinxauto.com",
      role: "admin",
      plan: "premium",
      expire_date: "2099-12-31T23:59:59.000Z",
      status: "active",
      is_active: true
    }
  };

  // Trả về JSON thành công
  return res.status(200).json(mockResponse);
}

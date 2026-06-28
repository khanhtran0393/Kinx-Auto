import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://enoectunfjojhplwenli.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

  const { path } = req.query; 
  console.log(`[AUTH INTERCEPT] Path: ${path}, Method: ${req.method}`);
  console.log(`[AUTH INTERCEPT] Body:`, req.body);

  try {
    // Trích xuất email/username và password từ request body (phụ thuộc vào app Kinx Auto gửi lên field gì)
    // Thông thường sẽ là email và password, hoặc username và password
    let body = req.body || {};
    if (typeof body === 'string') {
        try { 
            body = JSON.parse(body); 
        } catch(e) {
            // Thử parse URL-encoded
            try {
                const urlParams = new URLSearchParams(body);
                body = Object.fromEntries(urlParams);
            } catch(e2) {}
        }
    }

    const email = body.email || body.username || body.user;
    const password = body.password || body.pass;

    if (!email || !password) {
        return res.status(400).json({ status: 400, success: false, message: "Missing email or password" });
    }

    // Truy vấn Supabase bảng 'users' để đối chiếu
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password); // Lưu ý: thực tế nên băm (hash) mật khẩu, ở đây để cho dễ cấu hình ta so sánh plain text

    if (error) {
        console.error("Supabase Error:", error);
        return res.status(500).json({ status: 500, success: false, message: "Database error" });
    }

    if (users && users.length > 0) {
        const user = users[0];
        // Đăng nhập THÀNH CÔNG -> Trả về cấu trúc JSON giả lập License Premium
        const mockResponse = {
            status: 200,
            success: true,
            message: "Login successful",
            token: "kinx-auto-premium-token-bypass-2099",
            data: {
              id: user.id,
              email: user.email,
              role: user.role || "admin",
              plan: "premium",
              expire_date: "2099-12-31T23:59:59.000Z",
              status: "active",
              is_active: true
            }
        };
        return res.status(200).json(mockResponse);
    } else {
        // Đăng nhập THẤT BẠI
        return res.status(401).json({ status: 401, success: false, message: "Sai tài khoản hoặc mật khẩu (Invalid credentials)" });
    }
  } catch (err) {
      console.error(err);
      return res.status(500).json({ status: 500, success: false, message: "Internal server error" });
  }
}

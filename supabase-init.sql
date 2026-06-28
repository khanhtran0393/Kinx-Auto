-- 1. Tạo bảng api_keys để lưu trữ khóa của các nền tảng AI
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT UNIQUE NOT NULL,
    key_value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Thiết lập Row Level Security (RLS)
-- Chỉ cho phép truy cập thông qua Service Role Key (đã được cấu hình trên Vercel Backend)
-- Sẽ chặn hoàn toàn quyền đọc trực tiếp từ Client/Anon Key.
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Cho phép Service Role toàn quyền
CREATE POLICY "Enable all access for service_role only" 
ON public.api_keys 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- 3. Tạo Trigger tự động cập nhật trường updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER handle_updated_at_api_keys
    BEFORE UPDATE ON public.api_keys
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- 4. Khởi tạo sẵn các dòng (row) mặc định cho các nền tảng (Placeholder)
-- Bạn hãy vào giao diện Table Editor của Supabase để điền khóa thực tế (key_value) vào đây.
INSERT INTO public.api_keys (platform, key_value)
VALUES 
    ('gemini', 'YOUR_GEMINI_API_KEY_HERE'),
    ('openai', 'YOUR_OPENAI_API_KEY_HERE'),
    ('anthropic', 'YOUR_ANTHROPIC_API_KEY_HERE'),
    ('elevenlabs', 'YOUR_ELEVENLABS_API_KEY_HERE')
ON CONFLICT (platform) DO NOTHING;

-- 5. Tạo bảng users để quản lý tài khoản đăng nhập Kinx Auto
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Thiết lập bảo mật RLS cho bảng users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for service_role only" 
ON public.users 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Trigger cập nhật updated_at cho users
CREATE TRIGGER handle_updated_at_users
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Khởi tạo sẵn một tài khoản Admin mặc định
INSERT INTO public.users (email, password, role)
VALUES 
    ('admin@kinxauto.com', '123456', 'admin')
ON CONFLICT (email) DO NOTHING;


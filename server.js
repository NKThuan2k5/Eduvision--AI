require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// --- Thêm các imports mới cho xác thực ---
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// --- Kết thúc imports mới ---

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cấu hình Multer để lưu file ảnh tạm thời
const upload = multer({ dest: 'uploads/' });

// Khởi tạo OpenAI (với fallback nếu không có API key)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log('✅ OpenAI API initialized');
} else {
  console.log('⚠️ OpenAI API key not found - using fallback responses');
}

// --- Kết nối MongoDB (với fallback nếu không có URI) ---
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
  })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ Could not connect to MongoDB:', err));
} else {
  console.log('⚠️ MongoDB URI not found - database features disabled');
}

// --- Định nghĩa Schema người dùng ---
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Middleware để mã hóa mật khẩu trước khi lưu (chỉ khi mật khẩu bị thay đổi)
userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

const User = mongoose.model('User', userSchema);
// --- Kết thúc định nghĩa Schema người dùng ---

// --- Middleware xác thực JWT (đặt ở đây để có thể sử dụng cho các route khác) ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Lấy token từ 'Bearer TOKEN'

    if (token == null) return res.status(401).json({ message: 'Không tìm thấy token xác thực.' });

    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
        if (err) return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' }); // Token không hợp lệ
        req.user = user; // Lưu thông tin người dùng từ token vào req
        next(); // Chuyển sang middleware/route tiếp theo
    });
};
// --- Kết thúc Middleware xác thực JWT ---

// --- Fallback AI Response Function ---
function generateFallbackResponse(message) {
  const text = message.toLowerCase();

  // 🟩 Phương trình: chứa "=", "x", "y", "giải pt"
  if ((text.includes('=') && (text.includes('x') || text.includes('y'))) || text.includes('giải pt')) {
    return `🟩 Đây là bài toán phương trình.
Tôi sẽ giúp bạn giải phương trình đó từng bước. Ví dụ: '2x + 3 = 7' hoặc 'giải pt x^2 - 4 = 0'.`;
  }

  // 🟦 Tích phân: chứa "∫" hoặc "tính tích phân"
  if (text.includes('∫') || text.includes('tính tích phân')) {
    return `🟦 Đây là bài toán tích phân.
Hiện tại tôi hỗ trợ các tích phân cơ bản. Bạn vui lòng nhập biểu thức tích phân cụ thể để tôi giúp tính toán.`;
  }

  // 🟨 Lượng giác: có sin, cos, tan, góc
  if (text.includes('sin') || text.includes('cos') || text.includes('tan') || 
      text.includes('lượng giác') || text.includes('góc') || text.includes('°')) {
    return `🟨 Đây là bài toán lượng giác.
Tôi có thể giúp bạn tính các giá trị lượng giác cơ bản như sin, cos, tan và các góc đặc biệt (30°, 45°, 60°, 90°).`;
  }

  // 🟪 Đạo hàm: chứa "đạo hàm", "f'", "derivative"
  if (text.includes('đạo hàm') || text.includes("f'") || text.includes('derivative') || text.includes('d/dx')) {
    return `🟪 Đây là bài toán đạo hàm.
Tôi có thể giúp bạn tính đạo hàm của các hàm số cơ bản. Hãy cho tôi biết hàm số cần tính đạo hàm.`;
  }

  // 🟧 Hình học: chứa "diện tích", "chu vi", "thể tích"
  if (text.includes('diện tích') || text.includes('chu vi') || text.includes('thể tích') || 
      text.includes('hình học') || text.includes('tam giác') || text.includes('hình tròn')) {
    return `🟧 Đây là bài toán hình học.
Tôi có thể giúp bạn tính diện tích, chu vi, thể tích của các hình cơ bản như tam giác, hình tròn, hình chữ nhật.`;
  }

  // 🟥 Xác suất thống kê
  if (text.includes('xác suất') || text.includes('thống kê') || text.includes('probability')) {
    return `🟥 Đây là bài toán xác suất thống kê.
Tôi có thể giúp bạn giải các bài toán xác suất cơ bản và thống kê mô tả.`;
  }

  // 📚 Trả lời mặc định với gợi ý
  const responses = [
    `Xin chào! Tôi là AI hỗ trợ giải toán. Bạn có thể:
📝 Hỏi về phương trình (VD: "giải pt 2x + 3 = 7")
🧮 Tính tích phân (VD: "tính tích phân x^2")
📐 Hỏi về lượng giác (VD: "sin 30 độ")
📊 Tính đạo hàm (VD: "đạo hàm của x^3")`,
    
    `Tôi hiểu bạn muốn hỏi về toán học! Hãy cho tôi biết cụ thể:
• Loại bài toán (phương trình, tích phân, lượng giác...)
• Đề bài chi tiết
• Hoặc upload ảnh bài tập để tôi OCR và giải!`,
    
    `Để tôi hỗ trợ tốt nhất, bạn có thể:
🔍 Mô tả rõ đề bài
📷 Upload ảnh bài tập
💬 Hỏi trực tiếp loại toán cần giải
Tôi sẵn sàng giúp bạn học toán hiệu quả!`
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}

// --- Các Endpoint cho Đăng ký/Đăng nhập ---

// Endpoint Đăng ký người dùng
app.post('/api/register', async (req, res) => {
    if (!process.env.MONGODB_URI) {
        return res.status(503).json({ message: 'Dịch vụ đăng ký tạm thời không khả dụng.' });
    }

    const { username, email, password } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin (tên người dùng, email, mật khẩu).' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    try {
        // Kiểm tra xem email hoặc tên người dùng đã tồn tại chưa
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(409).json({ message: 'Email hoặc tên người dùng đã tồn tại.' });
        }

        // Tạo người dùng mới (mật khẩu sẽ được mã hóa bởi pre('save') middleware)
        const newUser = new User({ username, email, password });
        await newUser.save();

        res.status(201).json({ message: 'Đăng ký thành công!' });

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Đăng ký thất bại. Vui lòng thử lại.' });
    }
});

// Endpoint Đăng nhập người dùng
app.post('/api/login', async (req, res) => {
    if (!process.env.MONGODB_URI) {
        return res.status(503).json({ message: 'Dịch vụ đăng nhập tạm thời không khả dụng.' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu.' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
        }

        // Tạo JSON Web Token (JWT)
        const token = jwt.sign(
            { id: user._id, username: user.username, email: user.email }, // Payload của token
            process.env.JWT_SECRET || 'fallback_secret', // Secret key để ký token
            { expiresIn: '1h' } // Token sẽ hết hạn sau 1 giờ
        );

        res.json({
            message: 'Đăng nhập thành công!',
            token,
            user: { id: user._id, username: user.username, email: user.email } // Trả về thông tin người dùng (không có mật khẩu)
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Đăng nhập thất bại. Vui lòng thử lại.' });
    }
});

// --- Ví dụ về một route được bảo vệ (chỉ truy cập được khi đã đăng nhập) ---
app.get('/api/user-info', authenticateToken, (req, res) => {
    // req.user chứa thông tin từ payload của JWT
    res.json({
        message: 'Bạn đã đăng nhập thành công!',
        userInfo: req.user
    });
});
// --- Kết thúc các Endpoint cho Đăng ký/Đăng nhập ---

/**
 * Hàm phân loại dạng bài toán dựa trên đoạn text đầu vào.
 * Hàm này chủ yếu dùng để gợi ý cho AI (trong prompt) và hiển thị cho người dùng trên frontend.
 * AI thực tế sẽ tự nhận diện dạng bài tốt hơn nếu prompt đủ linh hoạt.
 */
function classifyMathProblem(text) {
    text = text.toLowerCase();
    if (text.includes('∫') || text.includes('tích phân') || text.includes('nguyên hàm')) return 'integral';
    if (text.includes('sin') || text.includes('cos') || text.includes('tan') || text.includes('lượng giác') || text.includes('góc') || text.includes('hàm số lượng giác')) return 'trigonometry';
    if (text.includes('vẽ đồ thị') || text.includes('tọa độ') || text.includes('hàm số') || text.includes('khảo sát hàm số') || text.includes('parabol') || text.includes('đường thẳng')) return 'graph';
    if (text.includes('tam giác') || text.includes('đường tròn') || text.includes('hình vuông') || text.includes('hình chữ nhật') || text.includes('hình thang') || text.includes('diện tích') || text.includes('chu vi') || text.includes('vuông góc') || text.includes('song song') || text.includes('khoảng cách')) return 'geometry';
    if (text.includes('=') && (text.includes('x') || text.includes('y') || text.includes('giải pt') || text.includes('phương trình') || text.includes('bất phương trình'))) return 'equation';
    if (text.includes('một người') || text.includes('một vật') || text.includes('chuyển động') || text.includes('bài toán lời văn') || text.includes('bài toán có lời')) return 'word_problem';
    if (text.includes('đạo hàm') || text.includes('giới hạn') || text.includes('lim')) return 'calculus';
    if (text.includes('vector') || text.includes('ma trận') || text.includes('không gian')) return 'linear_algebra';
    if (text.includes('xác suất') || text.includes('thống kê') || text.includes('trung bình') || text.includes('phương sai')) return 'statistics';
    return 'general_math'; // Mặc định cho các bài toán không rõ loại
}

// Endpoint xử lý OCR ảnh sang text
app.post('/api/ocr', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Không tìm thấy file ảnh.', details: 'Vui lòng tải lên một file ảnh.' });
  }
  try {
    const { path: imagePath } = req.file;
    // Sử dụng 'vie+eng' để nhận diện cả tiếng Việt và tiếng Anh (tốt cho toán học)
    const result = await Tesseract.recognize(imagePath, 'vie+eng');
    fs.unlinkSync(imagePath); // Xóa file ảnh tạm sau khi xử lý

    // Kiểm tra nếu OCR không nhận diện được text nào
    if (!result.data.text || result.data.text.trim() === '') {
        return res.status(400).json({ error: 'Không thể nhận diện văn bản từ ảnh.', details: 'Vui lòng thử ảnh khác hoặc đảm bảo văn bản rõ ràng.' });
    }

    res.json({ text: result.data.text });
  } catch (error) {
    console.error('OCR Error:', error);
    res.status(500).json({ error: 'OCR thất bại.', details: error.message || 'Lỗi trong quá trình nhận diện văn bản.' });
  }
});

// Endpoint giải toán dựa trên câu hỏi text
app.post('/api/solve', async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Không tìm thấy câu hỏi.', details: 'Vui lòng cung cấp nội dung bài toán.' });
  }

  try {
    const problemType = classifyMathProblem(question); // Phân loại để có thể dùng trong prompt nếu muốn tinh chỉnh

    if (!openai) {
      // Fallback response nếu không có OpenAI API
      const fallbackAnswer = generateFallbackResponse(question);
      return res.json({ answer: fallbackAnswer, problemType: problemType });
    }

    // Prompt tối ưu hơn để GPT giải quyết đa dạng các dạng bài toán
    const prompt = `Bạn là một gia sư toán học AI chuyên nghiệp, có kinh nghiệm và khả năng giải thích các bài toán phức tạp một cách dễ hiểu và chi tiết.
Tôi cung cấp một đề bài toán, hãy thực hiện các bước sau:
    1.  **Phân tích đề bài:** Xác định rõ ràng yêu cầu của bài toán và các thông tin đã cho.
    2.  **Xác định dạng toán:** Nhận diện đây là dạng toán gì (ví dụ: phương trình, lượng giác, tích phân, hình học, bài toán lời văn, v.v.).
    3.  **Nêu kiến thức/công thức áp dụng:** Liệt kê các định lý, công thức, hoặc khái niệm toán học liên quan cần sử dụng.
    4.  **Trình bày lời giải chi tiết từng bước:** Giải thích từng bước giải một cách logic, rõ ràng, dễ hiểu. Sử dụng các ký hiệu toán học phù hợp (ví dụ: \\frac{a}{b} cho phân số, \\sqrt{x} cho căn bậc hai, \\sin(x) cho sin).
    5.  **Kết quả cuối cùng:** Đưa ra đáp án cuối cùng của bài toán.
    
    Đề bài bạn cần giải: "${question}"`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Sử dụng model mạnh nhất của OpenAI cho kết quả tốt nhất
      messages: [
        { role: 'system', content: 'Bạn là một gia sư toán học chuyên nghiệp, có khả năng giải thích các bài toán phức tạp một cách dễ hiểu và chi tiết. Luôn sử dụng LaTeX cho các biểu thức toán học.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5, // Giảm temperature để câu trả lời ít ngẫu nhiên và chính xác hơn
      max_tokens: 1500, // Tăng max_tokens để có lời giải dài và chi tiết
    });

    const answer = completion.choices[0].message.content;
    res.json({ answer, problemType: problemType }); // Trả về cả problemType để frontend hiển thị màu
  } catch (error) {
    console.error('OpenAI Solve Error:', error.message);
    
    // Fallback to local response on OpenAI error
    const fallbackAnswer = generateFallbackResponse(question);
    const problemType = classifyMathProblem(question);
    
    if (error.response && error.response.status === 429) {
      res.status(200).json({ answer: fallbackAnswer + '\n\n⚠️ Đang dùng chế độ demo do quá nhiều yêu cầu đến AI.', problemType: problemType });
    } else {
      res.status(200).json({ answer: fallbackAnswer + '\n\n⚠️ Đang dùng chế độ demo do lỗi AI.', problemType: problemType });
    }
  }
});

// *** FIX: Add the missing /api/smart-chat endpoint ***
app.post('/api/smart-chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ reply: 'Vui lòng nhập tin nhắn.' });
  }

  try {
    if (!openai) {
      // Use fallback response if no OpenAI API
      const reply = generateFallbackResponse(message);
      return res.json({ reply });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Bạn là một gia sư toán học AI thông minh và thân thiện. Bạn có thể giải thích các khái niệm toán học, làm rõ các bước giải, và trả lời các câu hỏi liên quan đến toán học một cách dễ hiểu. Hãy giữ các câu trả lời của bạn tập trung vào chủ đề toán học.' },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error('OpenAI Smart Chat Error:', error.message);
    
    // Always provide fallback response
    const reply = generateFallbackResponse(message);
    res.json({ reply });
  }
});

// Endpoint chat chung (dùng để hỏi thêm về lời giải hoặc các vấn đề khác)
app.post('/api/chat', async (req, res) => {
  const { message, conversationHistory = [] } = req.body; // Nhận lịch sử hội thoại
  if (!message) {
    return res.status(400).json({ error: 'Không có tin nhắn để chat.', details: 'Vui lòng nhập tin nhắn.' });
  }

  try {
    if (!openai) {
      // Use fallback response if no OpenAI API
      const reply = generateFallbackResponse(message);
      return res.json({ reply });
    }

    // Chuyển đổi lịch sử hội thoại sang định dạng mong muốn của OpenAI
    const messages = [
      { role: 'system', content: 'Bạn là một gia sư toán học AI thông minh và thân thiện. Bạn có thể giải thích các khái niệm toán học, làm rõ các bước giải, và trả lời các câu hỏi liên quan đến toán học một cách dễ hiểu. Hãy giữ các câu trả lời của bạn tập trung vào chủ đề toán học và sử dụng LaTeX cho các biểu thức toán học nếu có.' },
      ...conversationHistory.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text })),
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Hoặc 'gpt-3.5-turbo' nếu muốn tiết kiệm chi phí
      messages: messages,
      temperature: 0.7, // Nhiệt độ cao hơn một chút cho chatbot để linh hoạt
      max_tokens: 500,
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error('OpenAI Chat Error:', error.message);
    
    // Always provide fallback response
    const reply = generateFallbackResponse(message);
    res.json({ reply });
  }
});

app.listen(port, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${port}`);
  console.log('📋 Để sử dụng đầy đủ tính năng, hãy cấu hình:');
  console.log('   - OPENAI_API_KEY: ' + (process.env.OPENAI_API_KEY ? '✅' : '❌'));
  console.log('   - MONGODB_URI: ' + (process.env.MONGODB_URI ? '✅' : '❌'));
  console.log('   - JWT_SECRET: ' + (process.env.JWT_SECRET ? '✅' : '❌'));
});
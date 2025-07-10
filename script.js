// Khai báo API Key của Gemini (Google AI)
const Genmini_KEY = "AIzaSyAsXqLNIGr4VPGf4kfvykzROKB6Fp2nAiw"; // Vui lòng thay thế bằng API Key thật của bạn!

// Lấy các phần tử DOM cần thao tác từ giao diện HTML
const input = document.getElementById('inputImage');      // Ô chọn ảnh
const solutionDiv = document.getElementById('solution'); // Khu vực hiển thị kết quả giải
const chatBox = document.getElementById('chatBox');       // Khung chat
const chatInput = document.getElementById('chatInput');   // Ô nhập tin nhắn
const sendBtn = document.getElementById('sendBtn');       // Nút gửi tin nhắn

// Xử lý sự kiện khi người dùng nhấn nút "Giải bài"
document.getElementById('solveBtn').addEventListener('click', async () => {
    if (!input.files || input.files.length === 0) {
        alert('Vui lòng chọn một ảnh bài tập!');
        return;
    }

    const imageFile = input.files[0];
    solutionDiv.innerText = "🧠 Đang nhận dạng ảnh...";

    try {
        // Dùng Tesseract.js để nhận dạng văn bản trong ảnh
        const result = await Tesseract.recognize(imageFile, 'eng', {
            logger: m => console.log(m) // In ra tiến trình OCR
        });

        const extractedText = result.data.text.trim(); // Lấy văn bản đã nhận dạng
        if (!extractedText) {
            solutionDiv.innerText = "❌ Không nhận dạng được nội dung trong ảnh.";
            return;
        }

        // Hiển thị văn bản và gọi AI để giải
        solutionDiv.innerText = `📄 Nội dung nhận dạng:\n${extractedText}\n\n🤖 Đang giải bài...`;

        // Đưa câu hỏi từ ảnh vào khung chat
        addChatMessage("Bạn (ảnh)", extractedText, 'user');
        showTypingIndicator(); // Hiện chỉ báo AI đang suy nghĩ

        const aiReply = await getGeminiSolution(extractedText); // Gửi cho Gemini

        solutionDiv.innerText = `📄 Bài toán:\n${extractedText}\n\n✅ Lời giải:\n${aiReply}`;
        hideTypingIndicator(); // Ẩn chỉ báo
        addChatMessage("AI", aiReply, 'ai'); // Thêm lời giải vào khung chat
    } catch (err) {
        console.error(err);
        solutionDiv.innerText = "❌ Lỗi khi nhận dạng hoặc xử lý ảnh.";
        hideTypingIndicator();
        addChatMessage("AI", "⚠️ Lỗi khi nhận dạng hoặc xử lý ảnh.", 'ai');
    }
});

// Hàm gửi văn bản tới Gemini API và lấy kết quả giải bài toán
async function getGeminiSolution(text) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${Genmini_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text }] }] })
        });

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "🤖 Không có phản hồi từ AI.";
    } catch (error) {
        console.error("Lỗi gọi Gemini:", error);
        return "⚠️ Có lỗi xảy ra khi kết nối với AI.";
    }
}

// Gửi tin nhắn khi nhấn Enter trong ô chat
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendBtn.click();
});

// Gửi tin nhắn khi bấm nút Gửi
sendBtn.addEventListener('click', async () => {
    const userText = chatInput.value.trim();
    if (!userText) return;

    addChatMessage('Bạn', userText, 'user'); // Hiển thị tin nhắn của người dùng
    chatInput.value = '';
    chatInput.disabled = true;
    sendBtn.disabled = true;

    showTypingIndicator(); // Hiện AI đang trả lời
    await callGeminiAPI(userText); // Gọi AI để trả lời
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.focus();
});

// Hàm thêm tin nhắn vào khung chat (tự động căn trái/phải tùy người gửi)
function addChatMessage(sender, text, type) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('mb-3', 'p-3', 'rounded-lg', 'max-w-sm', 'whitespace-pre-line');

    if (type === 'user') {
        msgDiv.classList.add('bg-blue-500', 'text-white', 'ml-auto', 'text-right'); // Người dùng: xanh, căn phải
    } else {
        msgDiv.classList.add('bg-gray-100', 'text-gray-800', 'mr-auto'); // AI: xám, căn trái
    }

    msgDiv.innerHTML = `
        <div class="font-bold mb-1 ${type === 'user' ? 'text-blue-100' : 'text-blue-600'}">${sender}</div>
        <div>${text}</div>
    `;

    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight; // Tự cuộn xuống cuối
}

// Hiển thị hiệu ứng AI đang gõ (gợi cảm giác đối thoại)
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typing-indicator';
    typingDiv.classList.add('mb-3', 'p-3', 'rounded-lg', 'bg-gray-100', 'text-gray-600', 'max-w-sm', 'mr-auto');
    typingDiv.innerHTML = `
        <div class="font-bold mb-1 text-blue-600">AI</div>
        <div class="typing-dots">
            <span>●</span><span>●</span><span>●</span> Đang suy nghĩ...
        </div>
    `;
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollTop;
}

// Ẩn hiệu ứng AI đang gõ
function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) typingIndicator.remove();
}

// Hàm gọi Gemini API để trả lời tin nhắn văn bản nhập tay
async function callGeminiAPI(text) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${Genmini_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text }] }] })
        });

        const data = await response.json();
        hideTypingIndicator();

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "🤖 Không có phản hồi từ AI.";
        addChatMessage('AI', reply, 'ai');
    } catch (error) {
        hideTypingIndicator();
        console.error("Lỗi khi gọi Gemini API:", error);
        addChatMessage('AI', "⚠️ Có lỗi xảy ra khi gọi API. Vui lòng thử lại sau.", 'ai');
    }
}

// Chức năng lưu lại lịch sử trò chuyện
let historyData = [];
let filteredData = [];
let currentFilter = 'all';

// Initialize the page - Đã sửa để gọi setupEventListeners sau khi load dữ liệu
document.addEventListener('DOMContentLoaded', function () {
    loadHistoryData();
    setupEventListeners(); // Gọi hàm này để thiết lập tất cả các sự kiện, bao gồm xử lý tab
    updateStatistics(); // Cập nhật thống kê ban đầu
});

// Setup event listeners - Đã tích hợp logic xử lý tab vào đây
function setupEventListeners() {
    // --- Xử lý chuyển đổi Tab (Đảm bảo chỉ có một phần này) ---
    const tabButtons = document.querySelectorAll('.tab-button'); // HTML của bạn dùng class 'tab-button'
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', function (e) {
            e.preventDefault(); // Ngăn hành vi mặc định của thẻ <a> hoặc <button> nếu có
            // Lấy data-tab (ví dụ: "historyTab", "statsTab", "liveClassTab")
            const targetTabId = this.dataset.tab;

            // Xóa 'active' khỏi tất cả nút tab và ẩn tất cả nội dung tab
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.add('hidden'));

            // Thêm 'active' cho nút được click và hiển thị nội dung tab tương ứng
            this.classList.add('active');
            const targetContent = document.getElementById(targetTabId);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }

            // Nếu chuyển sang tab thống kê, gọi hàm loadDetailedStats
            if (targetTabId === 'statsTab') { // Lưu ý: dataset.tab là 'statsTab', không phải 'stats'
                loadDetailedStats();
            }
        });
    });

    // Khởi tạo trạng thái tab ban đầu khi tải trang
    // Tìm nút tab có class 'active' ban đầu trong HTML
    const initialActiveTabButton = document.querySelector('.tab-button.active');
    if (initialActiveTabButton) {
        // Giả lập một lần click vào nút active mặc định để khởi tạo trạng thái
        initialActiveTabButton.click();
    } else {
        // Nếu không có tab nào active mặc định, mặc định kích hoạt tab "Lịch Sử Học Tập"
        const defaultTabButton = document.querySelector('[data-tab="historyTab"]');
        if (defaultTabButton) {
            defaultTabButton.click();
        }
    }

    // --- Các Event Listeners hiện có của bạn (được giữ nguyên) ---

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            setActiveFilter(this);
            filterHistory(this.dataset.filter);
        });
    });

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            searchHistory();
        });
    }

    // Close modals when clicking outside
    window.addEventListener('click', function (event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });

    // Lắng nghe sự kiện cho nút "Xem Lời Giải Bài Toán" (solveBtn)
    // Phần này đã được đặt ở đầu file, tôi đã giữ nguyên ở đó để tránh trùng lặp
    // và đảm bảo nó được gán listener ngay lập tức.
    // Nếu bạn muốn gán nó trong setupEventListeners, hãy di chuyển nó vào đây
    // và xóa phần `document.getElementById('solveBtn').addEventListener('click', ...)` ở đầu file.
    // Dưới đây là phần code đã có trong setupEventListeners của bạn:
    const solveBtn = document.getElementById('solveBtn');
    const inputImage = document.getElementById('inputImage');
    const solutionDivForSolveBtn = document.getElementById('solution'); // Đổi tên biến để tránh trùng
    if (solveBtn && inputImage && solutionDivForSolveBtn) {
        solveBtn.addEventListener('click', async function () {
            if (inputImage.files.length === 0) {
                alert('Vui lòng chọn một ảnh bài tập.');
                return;
            }

            const file = inputImage.files[0];
            const reader = new FileReader();

            reader.onload = async function (e) {
                solutionDivForSolveBtn.innerHTML = '<div class="loading"><div class="spinner"></div> Đang xử lý...</div>';
                try {
                    // Bước 1: OCR với Tesseract.js
                    const { data: { text } } = await Tesseract.recognize(
                        e.target.result,
                        'vie', // Ngôn ngữ tiếng Việt
                        { logger: m => console.log(m) }
                    );

                    const problemText = text.trim();
                    if (!problemText) {
                        solutionDivForSolveBtn.innerHTML = 'Không tìm thấy văn bản trong ảnh. Vui lòng thử ảnh khác.';
                        return;
                    }

                    // Gọi API Gemini hoặc hàm xử lý AI của bạn
                    // Đây là nơi bạn sẽ gọi getGeminiSolution thực sự
                    const aiSolution = await getGeminiSolution(problemText); // Gọi hàm đã định nghĩa ở trên
                    const problemType = classifyProblemType(problemText); // Hàm phân loại

                    solutionDivForSolveBtn.innerHTML = `
                        <h4 style="margin-bottom: 10px;">Đề Bài Từ Ảnh:</h4>
                        <div style="background: #f8f9fa; padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #eee;">
                            ${problemText.replace(/\n/g, '<br>')}
                        </div>
                        <h4 style="margin-bottom: 10px;">Lời Giải Từ AI:</h4>
                        <div style="background: #e8f5e8; padding: 10px; border-radius: 8px; white-space: pre-line; border: 1px solid #cfc;">
                            ${aiSolution}
                        </div>
                    `;

                    // Thêm bài giải vào lịch sử
                    addProblemToHistory(problemText, aiSolution, problemType);

                } catch (error) {
                    console.error('Lỗi xử lý ảnh hoặc AI:', error);
                    solutionDivForSolveBtn.innerHTML = '<p style="color: red;">Đã xảy ra lỗi khi xử lý bài tập. Vui lòng thử lại.</p>';
                }
            };
            reader.readAsDataURL(file);
        });
    }

    // Lắng nghe sự kiện cho nút "Gửi" của Chatbot
    // Phần này cũng đã được đặt ở đầu file, tôi đã giữ nguyên ở đó.
    // Nếu bạn muốn gán nó trong setupEventListeners, hãy di chuyển nó vào đây
    // và xóa các phần `chatInput.addEventListener('keypress', ...)` và `sendBtn.addEventListener('click', ...)` ở đầu file.
    // Dưới đây là phần code đã có trong setupEventListeners của bạn:
    const chatInputForChatbot = document.getElementById('chatInput'); // Đổi tên biến để tránh trùng
    const sendBtnForChatbot = document.getElementById('sendBtn');     // Đổi tên biến để tránh trùng
    const chatBoxForChatbot = document.getElementById('chatBox');     // Đổi tên biến để tránh trùng

    if (chatInputForChatbot && sendBtnForChatbot && chatBoxForChatbot) {
        sendBtnForChatbot.addEventListener('click', async function () {
            const userMessage = chatInputForChatbot.value.trim();
            if (userMessage === '') return;

            // Thêm tin nhắn người dùng vào chat box
            appendMessage(chatBoxForChatbot, userMessage, 'user');
            chatInputForChatbot.value = '';
            chatBoxForChatbot.scrollTop = chatBoxForChatbot.scrollHeight; // Cuộn xuống cuối

            // Mô phỏng phản hồi từ AI
            appendMessage(chatBoxForChatbot, '<div class="loading-dots"><span>.</span><span>.</span><span>.</span></div>', 'ai');
            chatBoxForChatbot.scrollTop = chatBoxForChatbot.scrollHeight;

            try {
                // Gọi API Gemini hoặc hàm xử lý AI của bạn
                const aiResponse = await callGeminiAPI(userMessage); // Gọi hàm đã định nghĩa ở trên

                // Loại bỏ loading dots
                const loadingDots = chatBoxForChatbot.querySelector('.loading-dots');
                if (loadingDots && loadingDots.parentElement) {
                    loadingDots.parentElement.remove(); // Xóa div chứa loading dots
                }

                // addChatMessage đã được điều chỉnh để không cần appendMessage riêng
                addChatMessage('AI', aiResponse, 'ai');
                chatBoxForChatbot.scrollTop = chatBoxForChatbot.scrollHeight;

                if (userMessage.length > 20 && !userMessage.toLowerCase().includes("chào") && !userMessage.toLowerCase().includes("bạn là ai")) {
                    const problemType = classifyProblemType(userMessage);
                    addProblemToHistory(userMessage, aiResponse, problemType);
                }

            } catch (error) {
                console.error('Lỗi chatbot:', error);
                // Loại bỏ loading dots và hiển thị lỗi
                const loadingDots = chatBoxForChatbot.querySelector('.loading-dots');
                if (loadingDots && loadingDots.parentElement) {
                    loadingDots.parentElement.remove();
                }
                addChatMessage('AI', 'Đã xảy ra lỗi khi xử lý. Vui lòng thử lại.', 'ai');
                chatBoxForChatbot.scrollTop = chatBoxForChatbot.scrollHeight;
            }
        });

        // Cho phép gửi tin nhắn bằng Enter
        chatInputForChatbot.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendBtnForChatbot.click();
            }
        });
    }

    // --- NEW CODE START: Lắng nghe sự kiện cho nút Tham gia Google Meet ---
    const joinGoogleMeetBtn = document.getElementById('join-google-meet-btn');
    if (joinGoogleMeetBtn) {
        joinGoogleMeetBtn.addEventListener('click', () => {
            // Mở liên kết Google Meet trong một tab mới
            window.open('https://meet.google.com/new', '_blank');
        });
    }
    // --- NEW CODE END ---
}

// Hàm giả lập phản hồi của Gemini (thay thế bằng API thật của bạn)
// Lưu ý: Hàm này đã được sử dụng trong getGeminiSolution và callGeminiAPI ở trên
// nên bạn không cần simulateGeminiResponse và simulateChatbotResponse nữa,
// trừ khi bạn muốn giữ lại chúng cho mục đích mô phỏng.
// Tôi sẽ giữ lại simulateGeminiResponse và simulateChatbotResponse vì code gốc của bạn có chúng.
async function simulateGeminiResponse(problemText) {
    // Trong thực tế, bạn sẽ gửi `problemText` đến Gemini API và nhận lại lời giải.
    console.log("Mô phỏng gọi Gemini với đề:", problemText);
    return new Promise(resolve => {
        setTimeout(() => {
            let solution = "Đây là lời giải mô phỏng từ AI cho đề bài của bạn.";
            if (problemText.toLowerCase().includes("phương trình")) {
                solution = "Để giải phương trình này, ta thực hiện các bước sau:\n1. Thu gọn các số hạng.\n2. Chuyển vế để tìm giá trị của biến.\nVí dụ: 2x + 4 = 10 => 2x = 6 => x = 3.";
            } else if (problemText.toLowerCase().includes("diện tích") || problemText.toLowerCase().includes("hình tròn") || problemText.toLowerCase().includes("hình vuông")) {
                solution = "Để tính diện tích, bạn cần biết công thức phù hợp với hình dạng. Ví dụ, diện tích hình tròn là pi*r^2.";
            } else if (problemText.toLowerCase().includes("đạo hàm")) {
                solution = "Đạo hàm là tốc độ thay đổi của hàm số. Ví dụ: đạo hàm của x^2 là 2x.";
            } else if (problemText.toLowerCase().includes("sin") || problemText.toLowerCase().includes("cos")) {
                solution = "Các hàm lượng giác sin, cos, tan thường được dùng trong hình học và vật lý. Bạn có thể dùng bảng giá trị hoặc máy tính.";
            }
            resolve(solution);
        }, 1500); // Mô phỏng độ trễ API
    });
}

// Hàm giả lập phản hồi của Chatbot (thay thế bằng API thật của bạn)
async function simulateChatbotResponse(userMessage) {
    console.log("Mô phỏng chatbot với tin nhắn:", userMessage);
    return new Promise(resolve => {
        setTimeout(() => {
            let response = "Tôi là AI gia sư, rất vui được giúp đỡ bạn. Bạn có câu hỏi nào về toán học không?";
            if (userMessage.toLowerCase().includes("giải bài")) {
                response = "Bạn có thể gửi đề bài cho tôi, tôi sẽ cố gắng giải đáp chi tiết.";
            } else if (userMessage.toLowerCase().includes("công thức") || userMessage.toLowerCase().includes("là gì")) {
                response = "Để tôi tìm hiểu và giải thích cho bạn về công thức này.";
            } else if (userMessage.toLowerCase().includes("bạn là ai")) {
                response = "Tôi là một trợ lý AI được đào tạo bởi Google để hỗ trợ bạn học toán.";
            }
            resolve(response);
        }, 1000); // Mô phỏng độ trễ
    });
}

// Hàm để thêm tin nhắn vào chat box
function appendMessage(chatBoxElement, message, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender);
    messageElement.innerHTML = message; // Dùng innerHTML để hỗ trợ loading dots
    chatBoxElement.appendChild(messageElement);
}

// Hàm phân loại loại bài tập (có thể cải tiến bằng AI sau này)
function classifyProblemType(text) {
    text = text.toLowerCase();
    if (text.includes("phương trình") || text.includes("giải pt") || text.includes("tìm x") || text.includes("hệ phương trình")) {
        return "equation";
    }
    if (text.includes("diện tích") || text.includes("chu vi") || text.includes("hình tròn") || text.includes("hình vuông") || text.includes("hình tam giác") || text.includes("hình học")) {
        return "geometry";
    }
    if (text.includes("đạo hàm") || text.includes("nguyên hàm") || text.includes("tích phân") || text.includes("giới hạn")) {
        return "calculus";
    }
    if (text.includes("sin") || text.includes("cos") || text.includes("tan") || text.includes("lượng giác")) {
        return "trigonometry";
    }
    // Mặc định hoặc khi không xác định được rõ
    return "algebra";
}

// Load history data (mock data for demo)
function loadHistoryData() {
    // Simulate loading from localStorage or API
    const savedHistory = localStorage.getItem('mathHistory');
    if (savedHistory) {
        historyData = JSON.parse(savedHistory);
    } else {
        // Generate sample data (chỉ chạy khi chưa có lịch sử)
        historyData = generateSampleHistory();
        localStorage.setItem('mathHistory', JSON.stringify(historyData));
    }

    filteredData = [...historyData];
    renderHistory();
}

// Generate sample history data
function generateSampleHistory() {
    const sampleProblems = [
        {
            id: 1,
            problem: "Giải phương trình: 2x + 3 = 7",
            solution: "Bước 1: Chuyển 3 sang vế phải: 2x = 7 - 3 = 4\nBước 2: Chia hai vế cho 2: x = 4/2 = 2",
            type: "equation",
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            favorite: false
        },
        {
            id: 2,
            problem: "Tính diện tích hình tròn có bán kính 5cm",
            solution: "Công thức: S = πr²\nS = π × 5² = 25π ≈ 78.54 cm²",
            type: "geometry",
            timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            favorite: true
        },
        {
            id: 3,
            problem: "Tính đạo hàm của f(x) = x³ + 2x² - 5x + 1",
            solution: "f'(x) = 3x² + 4x - 5",
            type: "calculus",
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            favorite: false
        },
        {
            id: 4,
            problem: "Tính sin(30°) + cos(60°)",
            solution: "sin(30°) = 1/2\ncos(60°) = 1/2\nKết quả: 1/2 + 1/2 = 1",
            type: "trigonometry",
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            favorite: true
        },
        {
            id: 5,
            problem: "Giải hệ phương trình: x + y = 5, 2x - y = 1",
            solution: "Từ phương trình 1: y = 5 - x\nThế vào phương trình 2: 2x - (5 - x) = 1\n3x - 5 = 1\nx = 2, y = 3",
            type: "algebra",
            timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            favorite: false
        }
    ];
    return sampleProblems;
}

// Render history list
function renderHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    if (filteredData.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <h3>Chưa có lịch sử</h3>
                <p>Hãy bắt đầu giải bài tập để xem lịch sử tại đây!</p>
            </div>
        `;
        return;
    }

    const historyHTML = filteredData.map(item => `
        <div class="history-item" onclick="showProblemDetails(${item.id})">
            <div class="history-item-header">
                <div>
                    <span class="problem-type type-${item.type}">${getTypeLabel(item.type)}</span>
                    ${item.favorite ? '<span style="color: #ffc107; margin-left: 10px;">⭐</span>' : ''}
                </div>
                <div class="timestamp">${formatTimestamp(item.timestamp)}</div>
            </div>
            <div class="problem-preview">${item.problem}</div>
            <div class="solution-preview">${item.solution.substring(0, 100)}...</div>
            <div class="history-actions">
                <button class="action-btn" onclick="event.stopPropagation(); toggleFavorite(${item.id})">
                    ${item.favorite ? '⭐ Bỏ yêu thích' : '☆ Yêu thích'}
                </button>
                <button class="action-btn" onclick="event.stopPropagation(); shareProblem(${item.id})">📤 Chia sẻ</button>
                <button class="action-btn" onclick="event.stopPropagation(); deleteHistoryItem(${item.id})">🗑️ Xóa</button>
            </div>
        </div>
    `).join('');

    historyList.innerHTML = historyHTML;
}

// Get type label in Vietnamese
function getTypeLabel(type) {
    const labels = {
        equation: 'Phương Trình',
        geometry: 'Hình Học',
        calculus: 'Giải Tích',
        trigonometry: 'Lượng Giác',
        algebra: 'Đại Số'
    };
    return labels[type] || 'Khác';
}

// Format timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Vừa xong';
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
}

// Filter history
function filterHistory(filter) {
    currentFilter = filter;
    if (filter === 'all') {
        filteredData = [...historyData];
    } else {
        filteredData = historyData.filter(item => item.type === filter);
    }
    renderHistory();
}

// Search history
function searchHistory() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm === '') {
        filterHistory(currentFilter);
        return;
    }

    filteredData = historyData.filter(item =>
        item.problem.toLowerCase().includes(searchTerm) ||
        item.solution.toLowerCase().includes(searchTerm)
    );
    renderHistory();
}

// Set active filter button
function setActiveFilter(activeBtn) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    activeBtn.classList.add('active');
}

// Update statistics
function updateStatistics() {
    const total = historyData.length;
    const today = historyData.filter(item => {
        const itemDate = new Date(item.timestamp);
        const todayDate = new Date();
        return itemDate.toDateString() === todayDate.toDateString();
    }).length;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const week = historyData.filter(item => new Date(item.timestamp) > weekAgo).length;

    // Find most common type
    const typeCounts = {};
    historyData.forEach(item => {
        typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    });
    // Tránh lỗi khi typeCounts rỗng (nếu historyData rỗng)
    let favoriteType = 'Khác';
    if (Object.keys(typeCounts).length > 0) {
        favoriteType = Object.keys(typeCounts).reduce((a, b) =>
            typeCounts[a] > typeCounts[b] ? a : b
        );
    }

    const totalEl = document.getElementById('totalProblems');
    const todayEl = document.getElementById('todayProblems');
    const weekEl = document.getElementById('weekProblems');
    const favoriteTypeEl = document.getElementById('favoriteType');

    if (totalEl) totalEl.textContent = total;
    if (todayEl) todayEl.textContent = today;
    if (weekEl) weekEl.textContent = week;
    if (favoriteTypeEl) favoriteTypeEl.textContent = getTypeLabel(favoriteType);
}

// Load detailed statistics
function loadDetailedStats() {
    const statsContainer = document.getElementById('detailedStats');
    if (!statsContainer) return;

    // Calculate detailed statistics
    const typeStats = {};
    historyData.forEach(item => {
        if (!typeStats[item.type]) {
            typeStats[item.type] = { count: 0, recent: 0 };
        }
        typeStats[item.type].count++;

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (new Date(item.timestamp) > weekAgo) {
            typeStats[item.type].recent++;
        }
    });

    // Tránh lỗi khi typeStats rỗng
    let mostFavoriteType = 'Khác';
    if (Object.keys(typeStats).length > 0) {
        mostFavoriteType = Object.keys(typeStats).reduce((a, b) => typeStats[a].count > typeStats[b].count ? a : b);
    }

    const statsHTML = `
        <div class="stats-grid">
            ${Object.entries(typeStats).map(([type, stats]) => `
                <div class="stat-card">
                    <div class="stat-number">${stats.count}</div>
                    <div class="stat-label">${getTypeLabel(type)}</div>
                    <div style="font-size: 12px; color: #999; margin-top: 5px;">
                        ${stats.recent} tuần này
                    </div>
                </div>
            `).join('')}
        </div>

        <div style="margin-top: 30px; color: black;">
            <h3>📈 Xu Hướng Học Tập</h3>
            <div style="background: var(--card--bg); padding: 20px; border-radius: 15px; margin-top: 15px; color: black;">
                <p>• Bạn đã giải tổng cộng <strong>${historyData.length}</strong> bài tập</p>
                <p>• Dạng bài yêu thích nhất: <strong>${getTypeLabel(mostFavoriteType)}</strong></p>
                <p>• Số bài yêu thích: <strong>${historyData.filter(item => item.favorite).length}</strong></p>
                <p>• Hoạt động gần đây: ${historyData.filter(item => {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        return new Date(item.timestamp) > threeDaysAgo;
    }).length} bài trong 3 ngày qua</p>
            </div>
        </div>
    `;

    statsContainer.innerHTML = statsHTML;
}

// Show problem details in modal
function showProblemDetails(id) {
    const problem = historyData.find(item => item.id === id);
    if (!problem) return;

    const modalContent = document.getElementById('modalContent');
    if (!modalContent) return;

    modalContent.innerHTML = `
        <div class="problem-type type-${problem.type}" style="display: inline-block; margin-bottom: 15px;">
            ${getTypeLabel(problem.type)}
        </div>
        <h4 style="margin-bottom: 15px;">Đề Bài:</h4>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
            ${problem.problem}
        </div>
        <h4 style="margin-bottom: 15px;">Lời Giải:</h4>
        <div style="background: #e8f5e8; padding: 15px; border-radius: 10px; white-space: pre-line;">
            ${problem.solution}
        </div>
        <div style="margin-top: 20px; text-align: center;">
            <button class="action-btn" onclick="toggleFavorite(${problem.id}); closeModal('problemModal');">
                ${problem.favorite ? '⭐ Bỏ yêu thích' : '☆ Thêm yêu thích'}
            </button>
            <button class="action-btn" onclick="shareProblem(${problem.id})">📤 Chia sẻ</button>
        </div>
    `;

    const problemModal = document.getElementById('problemModal');
    if (problemModal) {
        problemModal.style.display = 'block';
    }
}

// Toggle favorite status
function toggleFavorite(id) {
    const problem = historyData.find(item => item.id === id);
    if (problem) {
        problem.favorite = !problem.favorite;
        localStorage.setItem('mathHistory', JSON.stringify(historyData));
        renderHistory();
        updateStatistics(); // Cập nhật lại thống kê khi yêu thích/bỏ yêu thích
    }
}

// Share problem
function shareProblem(id) {
    const problem = historyData.find(item => item.id === id);
    if (problem && navigator.share) {
        navigator.share({
            title: 'Bài tập toán',
            text: `Đề bài: ${problem.problem}\nLời giải: ${problem.solution}`,
            url: window.location.href
        });
    } else if (problem) {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(`Đề bài: ${problem.problem}\nLời giải: ${problem.solution.substring(0, 200)}...`).then(() => {
            alert('Đã sao chép đề bài và lời giải vào clipboard!');
        });
    }
}

// Delete history item
function deleteHistoryItem(id) {
    if (confirm('Bạn có chắc muốn xóa bài tập này?')) {
        historyData = historyData.filter(item => item.id !== id);
        filteredData = filteredData.filter(item => item.id !== id);
        localStorage.setItem('mathHistory', JSON.stringify(historyData));
        renderHistory();
        updateStatistics();
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Close all modals
function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// Hàm để thêm bài giải mới vào lịch sử
function addProblemToHistory(problemText, solutionText, problemType) {
    // Tạo ID mới, đảm bảo duy nhất
    const newId = historyData.length > 0 ? Math.max(...historyData.map(item => item.id)) + 1 : 1;
    const newItem = {
        id: newId,
        problem: problemText,
        solution: solutionText,
        type: problemType,
        timestamp: new Date().toISOString(),
        favorite: false
    };
    historyData.push(newItem);
    localStorage.setItem('mathHistory', JSON.stringify(historyData));
    filteredData = [...historyData]; // Cập nhật filteredData để hiển thị ngay
    renderHistory(); // Render lại danh sách để hiển thị mục mới
    updateStatistics(); // Cập nhật lại thống kê
}

// Thêm hàm clearHistory (nếu chưa có)
function clearHistory() {
    if (confirm('Bạn có chắc muốn xóa TẤT CẢ lịch sử học tập? Hành động này không thể hoàn tác.')) {
        historyData = [];
        filteredData = [];
        localStorage.removeItem('mathHistory'); // Xóa khỏi localStorage
        renderHistory(); // Render lại danh sách trống
        updateStatistics(); // Cập nhật lại thống kê
        alert('Đã xóa toàn bộ lịch sử học tập.');
    }
}


// Alternative: Simple functional approach (if you prefer not to use classes)

class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'blue';
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.init();
    }

    init() {
        this.applyTheme();
        this.setupEventListeners();
        this.updateUI();
    }

    setupEventListeners() {
        // Dark/Light mode toggle
        const themeToggle = document.getElementById('themeToggle');
        themeToggle.addEventListener('click', () => this.toggleDarkMode());

        // Color theme switchers
        document.querySelectorAll('.color-switchers .btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.target.dataset.theme;
                this.setColorTheme(theme);
            });
        });
    }

    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode);
        this.applyTheme();
        this.updateUI();
    }

    setColorTheme(theme) {
        this.currentTheme = theme;
        localStorage.setItem('theme', theme);
        this.applyTheme();
        this.updateActiveTheme();
    }

    applyTheme() {
        const root = document.documentElement;

        // Apply dark/light mode
        if (this.isDarkMode) {
            document.body.setAttribute('data-theme', 'dark');
        } else {
            document.body.removeAttribute('data-theme');
        }

        // Apply color theme
        const themes = {
            blue: {
                primary: '#fff',
                secondary: '#24292d',
                accent: '#4070f4',
                accentHover: '#0b3cc1',
                accentLight: '#F0F8FF'
            },
            orange: {
                primary: '#fff',
                secondary: '#242526',
                accent: '#F79F1F',
                accentHover: '#DD8808',
                accentLight: '#fef5e6'
            },
            purple: {
                primary: '#fff',
                secondary: '#242526',
                accent: '#8e44ad',
                accentHover: '#783993',
                accentLight: '#eadaf1'
            },
            green: {
                primary: '#fff',
                secondary: '#242526',
                accent: '#3A9943',
                accentHover: '#2A6F31',
                accentLight: '#DAF1DC'
            }
        };

        const selectedTheme = themes[this.currentTheme];
        if (selectedTheme) {
            root.style.setProperty('--accent-color', selectedTheme.accent);
            root.style.setProperty('--accent-hover', selectedTheme.accentHover);
            root.style.setProperty('--accent-light', selectedTheme.accentLight);
        }

        // Add transition class for smooth theme changes
        document.body.classList.add('theme-transition');
        setTimeout(() => {
            document.body.classList.remove('theme-transition');
        }, 300);
    }

    updateUI() {
        const themeToggle = document.getElementById('themeToggle');
        if (this.isDarkMode) {
            themeToggle.className = 'btn fas fa-sun';
            themeToggle.title = 'Switch to Light Mode';
        } else {
            themeToggle.className = 'btn fas fa-moon';
            themeToggle.title = 'Switch to Dark Mode';
        }
    }

    updateActiveTheme() {
        document.querySelectorAll('.color-switchers .btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === this.currentTheme) {
                btn.classList.add('active');
            }
        });
    }
}

// Initialize theme manager
const themeManager = new ThemeManager();

document.addEventListener('DOMContentLoaded', () => {
    themeManager.updateActiveTheme();
});

// Add smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Bộ Điều Khiển Hiệu Ứng Cuộn Trang cho EduVision AI
class ScrollAnimationController {
  constructor() {
    this.animatedElements = new Set()
    this.init()
  }
  
  init() {
    this.setupIntersectionObserver()
    this.setupSmoothScrolling()
    this.setupScrollToTop()
    this.setupParallaxEffects()
    this.setupCounterAnimations()
    this.setupProgressBars()
  }
  
  // Observer chính cho hiệu ứng cuộn trang
  setupIntersectionObserver() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px",
    }
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !this.animatedElements.has(entry.target)) {
          this.animateElement(entry.target)
          this.animatedElements.add(entry.target)
        }
      })
    }, observerOptions)
    
    // Quan sát tất cả phần tử có class scroll-animate
    document.querySelectorAll(".scroll-animate").forEach((el) => {
      observer.observe(el)
    })
    
    // Quan sát thẻ tính năng cho hiệu ứng lệch thời gian
    document.querySelectorAll(".feature-card").forEach((el, index) => {
      el.style.animationDelay = `${index * 0.1}s`
      observer.observe(el)
    })
    
    // Quan sát thẻ bước
    document.querySelectorAll(".step-card").forEach((el, index) => {
      el.style.animationDelay = `${index * 0.2}s`
      observer.observe(el)
    })
    
    // Quan sát thẻ giá cả
    document.querySelectorAll(".pricing-card").forEach((el, index) => {
      el.style.animationDelay = `${index * 0.15}s`
      observer.observe(el)
    })
  }
  
  // Tạo hoạt hình cho từng phần tử
  animateElement(element) {
    const animationType = element.dataset.animation || "fadeInUp"
    element.style.opacity = "1"
    element.style.transform = "translateY(0)"
    element.classList.add("animate-in", animationType)
    
    // Thêm hoạt hình đặc biệt cho các phần tử cụ thể
    if (element.classList.contains("feature-card")) {
      this.animateFeatureCard(element)
    } else if (element.classList.contains("step-card")) {
      this.animateStepCard(element)
    } else if (element.classList.contains("pricing-card")) {
      this.animatePricingCard(element)
    }
  }
  
  // Hoạt hình đặc biệt cho thẻ tính năng
  animateFeatureCard(card) {
    const icon = card.querySelector(".feature-icon")
    if (icon) {
      setTimeout(() => {
        icon.style.transform = "scale(1.1) rotate(5deg)"
        setTimeout(() => {
          icon.style.transform = "scale(1) rotate(0deg)"
        }, 300)
      }, 200)
    }
  }
  
  // Hoạt hình đặc biệt cho thẻ bước
  animateStepCard(card) {
    const stepNumber = card.querySelector(".step-number")
    if (stepNumber) {
      stepNumber.style.transform = "scale(0)"
      setTimeout(() => {
        stepNumber.style.transition = "transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)"
        stepNumber.style.transform = "scale(1)"
      }, 100)
    }
  }
  
  // Hoạt hình đặc biệt cho thẻ giá cả
  animatePricingCard(card) {
    const price = card.querySelector(".pricing-price")
    if (price) {
      this.animateCounter(price, 0, Number.parseInt(price.textContent.replace(/\D/g, "")) || 0, 1000)
    }
  }
  
  // Hoạt hình đếm số
  animateCounter(element, start, end, duration) {
    const startTime = performance.now()
    const originalText = element.textContent
    
    const updateCounter = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const current = Math.floor(start + (end - start) * this.easeOutCubic(progress))
      
      if (originalText.includes("vnđ")) {
        element.textContent = `${current.toLocaleString()} vnđ`
      } else if (originalText.includes("%")) {
        element.textContent = `${current}%`
      } else {
        element.textContent = current.toLocaleString()
      }
      
      if (progress < 1) {
        requestAnimationFrame(updateCounter)
      } else {
        element.textContent = originalText
      }
    }
    
    requestAnimationFrame(updateCounter)
  }
  
  // Hàm làm mềm chuyển động
  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3)
  }
  
  // Thiết lập cuộn mượt cho liên kết neo
  setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", (e) => {
        e.preventDefault()
        const target = document.querySelector(anchor.getAttribute("href"))
        if (target) {
          target.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        }
      })
    })
  }
  
  // Thiết lập chức năng cuộn lên đầu trang
  setupScrollToTop() {
    // Tạo nút cuộn lên đầu trang
    const scrollToTopBtn = document.createElement("button")
    scrollToTopBtn.innerHTML = "↑"
    scrollToTopBtn.className = "scroll-to-top"
    scrollToTopBtn.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: var(--accent-color);
            color: white;
            border: none;
            font-size: 20px;
            cursor: pointer;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
            z-index: 1000;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        `
    document.body.appendChild(scrollToTopBtn)
    
    // Hiển thị/ẩn nút cuộn lên đầu trang
    window.addEventListener("scroll", () => {
      if (window.pageYOffset > 300) {
        scrollToTopBtn.style.opacity = "1"
        scrollToTopBtn.style.visibility = "visible"
      } else {
        scrollToTopBtn.style.opacity = "0"
        scrollToTopBtn.style.visibility = "hidden"
      }
    })
    
    // Chức năng cuộn lên đầu trang
    scrollToTopBtn.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      })
    })
  }
  
  // Thiết lập hiệu ứng thị sai
  setupParallaxEffects() {
    const parallaxElements = document.querySelectorAll(".floating-equation")
    
    window.addEventListener("scroll", () => {
      const scrolled = window.pageYOffset
      const rate = scrolled * -0.5
      
      parallaxElements.forEach((element, index) => {
        const speed = 0.5 + index * 0.1
        element.style.transform = `translateY(${rate * speed}px)`
      })
    })
  }
  
  // Thiết lập hoạt hình đếm cho thống kê
  setupCounterAnimations() {
    const statNumbers = document.querySelectorAll(".stat-number, .loop-number")
    
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !entry.target.dataset.animated) {
            const target = Number.parseInt(entry.target.textContent.replace(/\D/g, "")) || 0
            this.animateCounter(entry.target, 0, target, 2000)
            entry.target.dataset.animated = "true"
          }
        })
      },
      { threshold: 0.5 },
    )
    
    statNumbers.forEach((el) => {
      counterObserver.observe(el)
    })
  }
  
  // Thiết lập thanh tiến độ (nếu có)
  setupProgressBars() {
    const progressBars = document.querySelectorAll(".progress-bar")
    
    const progressObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const progressBar = entry.target
            const targetWidth = progressBar.dataset.progress || "100"
            progressBar.style.width = "0%"
            setTimeout(() => {
              progressBar.style.transition = "width 2s ease-out"
              progressBar.style.width = targetWidth + "%"
            }, 200)
          }
        })
      },
      { threshold: 0.5 },
    )
    
    progressBars.forEach((bar) => {
      progressObserver.observe(bar)
    })
  }
  
  // Thêm hoạt hình được kích hoạt bởi cuộn cho các phần cụ thể
  setupSectionAnimations() {
    const sections = document.querySelectorAll("section")
    
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("section-visible")
            
            // Kích hoạt hoạt hình cụ thể dựa trên phần
            if (entry.target.classList.contains("features")) {
              this.animateFeatureSection(entry.target)
            } else if (entry.target.classList.contains("how-it-works")) {
              this.animateStepsSection(entry.target)
            } else if (entry.target.classList.contains("pricing")) {
              this.animatePricingSection(entry.target)
            }
          }
        })
      },
      { threshold: 0.2 },
    )
    
    sections.forEach((section) => {
      sectionObserver.observe(section)
    })
  }
  
  // Tạo hoạt hình cho phần tính năng
  animateFeatureSection(section) {
    const cards = section.querySelectorAll(".feature-card")
    cards.forEach((card, index) => {
      setTimeout(() => {
        card.style.transform = "translateY(0) scale(1)"
        card.style.opacity = "1"
      }, index * 100)
    })
  }
  
  // Tạo hoạt hình cho phần các bước
  animateStepsSection(section) {
    const steps = section.querySelectorAll(".step-card")
    steps.forEach((step, index) => {
      setTimeout(() => {
        step.classList.add("animate-step")
      }, index * 200)
    })
  }
  
  // Tạo hoạt hình cho phần giá cả
  animatePricingSection(section) {
    const cards = section.querySelectorAll(".pricing-card")
    cards.forEach((card, index) => {
      setTimeout(() => {
        card.style.transform = "translateY(0) scale(1)"
        card.style.opacity = "1"
      }, index * 150)
    })
  }
  
  // Thêm hoạt hình đánh máy cho các phần tử văn bản
  setupTypingAnimation() {
    const typingElements = document.querySelectorAll("[data-typing]")
    
    typingElements.forEach((element) => {
      const text = element.textContent
      element.textContent = ""
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.typeText(element, text, 50)
            observer.unobserve(element)
          }
        })
      })
      
      observer.observe(element)
    })
  }
  
  // Hoạt hình đánh máy văn bản
  typeText(element, text, speed) {
    let i = 0
    const timer = setInterval(() => {
      element.textContent += text.charAt(i)
      i++
      if (i >= text.length) {
        clearInterval(timer)
      }
    }, speed)
  }
}

// CSS animations sẽ được chèn vào
const scrollAnimationCSS = `
    .scroll-animate {
        opacity: 0;
        transform: translateY(30px);
        transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .animate-in {
        opacity: 1 !important;
        transform: translateY(0) !important;
    }
    
    .fadeInUp {
        animation: fadeInUp 0.8s ease-out forwards;
    }
    
    .fadeInLeft {
        animation: fadeInLeft 0.8s ease-out forwards;
    }
    
    .fadeInRight {
        animation: fadeInRight 0.8s ease-out forwards;
    }
    
    .fadeInScale {
        animation: fadeInScale 0.8s ease-out forwards;
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(50px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes fadeInLeft {
        from {
            opacity: 0;
            transform: translateX(-50px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes fadeInRight {
        from {
            opacity: 0;
            transform: translateX(50px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes fadeInScale {
        from {
            opacity: 0;
            transform: scale(0.8);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
    
    .animate-step {
        animation: stepAnimation 0.6s ease-out forwards;
    }
    
    @keyframes stepAnimation {
        0% {
            opacity: 0;
            transform: translateY(30px) scale(0.9);
        }
        50% {
            transform: translateY(-10px) scale(1.05);
        }
        100% {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }
    
    .section-visible {
        animation: sectionFadeIn 1s ease-out forwards;
    }
    
    @keyframes sectionFadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    
    /* Hiệu ứng hover cho nút cuộn lên đầu trang */
    .scroll-to-top:hover {
        transform: translateY(-3px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }
    
    /* Hoạt hình cải tiến cho thẻ tính năng */
    .feature-card {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .feature-card:hover .feature-icon {
        animation: iconBounce 0.6s ease-in-out;
    }
    
    @keyframes iconBounce {
        0%, 100% { transform: scale(1) rotate(0deg); }
        25% { transform: scale(1.1) rotate(-5deg); }
        75% { transform: scale(1.1) rotate(5deg); }
    }
    
    /* Hoạt hình cải tiến cho thẻ giá cả */
    .pricing-card {
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .pricing-card:hover {
        transform: translateY(-15px) scale(1.02);
    }
    
    /* Hoạt hình thanh tiến độ */
    .progress-bar {
        height: 4px;
        background: var(--accent-color);
        border-radius: 2px;
        transition: width 0s;
    }
    
    /* Tối ưu hóa cho di động */
    @media (max-width: 768px) {
        .scroll-animate {
            transform: translateY(20px);
        }
        
        .scroll-to-top {
            bottom: 20px !important;
            right: 20px !important;
            width: 45px !important;
            height: 45px !important;
        }
    }
    
    /* Hỗ trợ giảm chuyển động */
    @media (prefers-reduced-motion: reduce) {
        .scroll-animate,
        .animate-in,
        .feature-card,
        .pricing-card {
            animation: none !important;
            transition: none !important;
        }
    }
`

// Khởi tạo hoạt hình cuộn khi DOM được tải
document.addEventListener("DOMContentLoaded", () => {
  // Chèn CSS
  const style = document.createElement("style")
  style.textContent = scrollAnimationCSS
  document.head.appendChild(style)
  
  // Khởi tạo bộ điều khiển hoạt hình cuộn
  const scrollController = new ScrollAnimationController()
  
  // Thêm hoạt hình tải cho trang
  document.body.style.opacity = "0"
  setTimeout(() => {
    document.body.style.transition = "opacity 0.5s ease-in-out"
    document.body.style.opacity = "1"
  }, 100)
  
  // Thiết lập các hiệu ứng cuộn bổ sung
  
  
  console.log("🎬 Hoạt hình cuộn trang đã được khởi tạo thành công!")
})

// Xuất để sử dụng bên ngoài nếu cần
window.ScrollAnimationController = ScrollAnimationController
// src/App.jsx
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'


// ⚙️ AYARLAR 

const supabaseUrl = "https://zkexbhhonuwrsmyrohis.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprZXhiaGhvbnV3cnNteXJvaGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NDI2MTcsImV4cCI6MjA4MjUxODYxN30.Dfz5v95NaQH4whVqrC7Z2ViFr0G8iSAv4kTsfbLpgTg";

// Bağlantıyı kuruyoruz
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null); // Otomatik kaydırma için

  // Sayfa açılınca çalışır
  useEffect(() => {
    // 1. Eski mesajları getir
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (data) setMessages(data);
    };
    fetchMessages();

    // 2. Canlı Dinleme (Realtime)
    // Veritabanına yeni satır eklenince burası tetiklenir
    const channel = supabase
      .channel('frontend-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
        setLoading(false);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mesaj Gönderme
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput(""); // Kutuyu temizle
    setLoading(true); // AI düşünüyor modu

    // Mesajı veritabanına kaydet 
    await supabase.from('messages').insert({
      content: userMessage,
      sender: 'user'
    });
  };

  return (
    <div className="chat-container">
      {/* ÜST BAR */}
      <div className="header">
        <div className="avatar">🎓</div>
        <div>
          <h2>Pembe fil</h2>
          <span className="status">● Çevrimiçi</span>
        </div>
      </div>

      {/* MESAJ ALANI */}
      <div className="messages-area">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-row ${msg.sender === 'user' ? 'my-message' : 'ai-message'}`}>
            <div className="message-bubble">
              {/* Markdown benzeri bold yazıları kalın yapalım */}
              <p dangerouslySetInnerHTML={{ __html: (msg.content || "").replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br />') }}></p>
              <span className="time">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        
        {/* Yükleniyor Animasyonu */}
        {loading && (
          <div className="message-row ai-message">
            <div className="message-bubble typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* GİRİŞ ALANI */}
      <div className="input-area">
        <input
          type="text"
          placeholder="Bir soru sorun... (Örn: 12345 borcu ne?)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage} disabled={!input.trim()}>
          ➤
        </button>
      </div>
    </div>
  )
}

export default App
import http from 'http';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import axios from 'axios';
import dotenv from 'dotenv';

// .env dosyasındaki ayarları yükle
dotenv.config();

console.log("🛠️ Sistem başlatılıyor ve ayarlar yükleniyor...");

// --- 1. KONFİGÜRASYON VE BAĞLANTILAR ---

// Supabase Bağlantısı
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// OpenAI Bağlantısı
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// CANLI API ADRESİ (Senin Swagger'daki adresin)
const API_URL = 'https://harc-api.onrender.com';


//  YARDIMCI FONKSİYONLAR

// Fonksiyon 1: Niyet Analizi kısmı 
async function analyzeIntent(userMessage) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", 
            messages: [
                {
                    role: "system",
                    content: `
                    Sen bir üniversite öğrenci işleri AI asistanısın. 
                    Görevin: Kullanıcının mesajını analiz edip JSON formatında çıktı vermek.
                    
                    Kullanılabilir Niyetler (intent):
                    - "QUERY_DEBT": Kullanıcı borç sorguluyor.
                    - "PAY_DEBT": Kullanıcı ödeme yapmak istiyor.
                    - "GREETING": Merhaba, nasılsın gibi sohbetler.
                    - "UNKNOWN": Konu dışı mesajlar.

                    Çıktı Formatı (JSON):
                    {
                        "intent": "QUERY_DEBT" | "PAY_DEBT" | "GREETING" | "UNKNOWN",
                        "studentNo": "Varsa öğrenci numarası (String), yoksa null",
                        "amount": "Varsa miktar (Number), yoksa null",
                        "term": "Varsa dönem (Örn: Guz 2024), yoksa null"
                    }
                    Sadece JSON döndür.
                    `
                },
                { role: "user", content: userMessage }
            ],
            temperature: 0,
        });

        let responseText = completion.choices[0].message.content;
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(responseText);

    } catch (error) {
        console.error("❌ OpenAI Hatası:", error);
        return { intent: "UNKNOWN" };
    }
}

// Fonksiyon 2: Aksiyon Yürütücü (DİREKT API KULLANIR)
async function executeAction(analysis) {
    // 1. Durum: Selamlaşma
    if (analysis.intent === "GREETING") {
        return "Merhaba! 👋 Size öğrenci harç sorgulama ve ödeme işlemlerinde yardımcı olabilirim. Lütfen öğrenci numaranızı yazın.";
    }

    // 2. Durum: Borç Sorgulama (API)
    if (analysis.intent === "QUERY_DEBT") {
        if (!analysis.studentNo) {
            return "Borcunuzu sorgulayabilmem için öğrenci numaranızı yazmanız gerekiyor.";
        }
        
        try {
            console.log(`📡 API'ye Soruluyor (GET): ${API_URL}/api/v1/mobile/inquiry -> No: ${analysis.studentNo}`);
            
            // Senin canlı API servisine istek atıyoruz
            const response = await axios.get(`${API_URL}/api/v1/mobile/inquiry`, {
                params: { studentNo: analysis.studentNo }
            });

            const { studentName, totalDebt } = response.data;
            return `Sayın **${studentName}**, sistemden sorgulandı. Güncel toplam borcunuz: **${totalDebt} TL** dir.`;

        } catch (error) {
            console.error("⚠️ API Hatası:", error.message);
            return "Sorgulama başarısız. Öğrenci numarası hatalı olabilir veya API servisine ulaşılamıyor.";
        }
    }

    // 3. Durum: Ödeme Yapma (API)
    if (analysis.intent === "PAY_DEBT") {
        if (!analysis.studentNo || !analysis.amount) {
            return "Ödeme işlemi için **Öğrenci Numarası** ve **Miktar** belirtmelisiniz.";
        }

        try {
            console.log(`💳 API'ye Ödeme İsteği (POST): ${API_URL}/api/v1/banking/payment`);
            
            // Veritabanı yerine senin BANKA API servisine istek atıyoruz
            const response = await axios.post(`${API_URL}/api/v1/banking/payment`, {
                studentNo: analysis.studentNo,
                amount: Number(analysis.amount)
            });

            return `✅ İşlem Başarılı! API üzerinden ödeme alındı.\n\n💰 **Ödenen:** ${analysis.amount} TL\nSisteme işlenmiştir.`;

        } catch (error) {
            console.error("❌ Ödeme API Hatası:", error.response ? error.response.data : error.message);
            return "Ödeme işlemi başarısız. Bakiye yetersiz olabilir veya öğrenci bulunamadı.";
        }
    }

    return "Ne demek istediğinizi tam anlayamadım. 'Borcum ne?' veya '100 tl öde' diyebilirsiniz.";
}

// 🎧 ANA DÖNGÜ

async function startListening() {
    console.log("🟢 AI Agent dinlemeye başladı... (Mesaj bekleniyor)");

    const channel = supabase
        .channel('ai-chat-room')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            async (payload) => {
                const newMessage = payload.new;
                if (newMessage.sender === 'ai') return; // Kendi mesajımıza cevap vermeyelim

                console.log(`\n📩 YENİ MESAJ: "${newMessage.content}"`);
                
                // Analiz Etme kısmı
                const analysis = await analyzeIntent(newMessage.content);
                const replyText = await executeAction(analysis);
                
                // Cevab yazma kısmı
                await supabase.from('messages').insert({
                    content: replyText,
                    sender: 'ai',
                });
                console.log("✅ Cevap gönderildi.");
            }
        )
        .subscribe();
}

startListening();

// --- RENDER İÇİN SAHTE SUNUCU (KAPATMA, BU GEREKLİ) ---
const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('AI Agent Calisiyor! (Render Port Dinleme Modu)\n');
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Render Web Servisi Başlatıldı! Port: ${PORT}`);
});
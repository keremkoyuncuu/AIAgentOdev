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

// Vize API Adresi
const VIZE_API_URL = process.env.VIZE_API_URL || 'http://localhost:3000';


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

// Fonksiyon 2: Aksiyon Yürütücü
async function executeAction(analysis) {
    // 1. Durum: Selamlaşma
    if (analysis.intent === "GREETING") {
        return "Merhaba! 👋 Size öğrenci harç sorgulama ve ödeme işlemlerinde yardımcı olabilirim. Lütfen öğrenci numaranızı yazın.";
    }

    // 2. Durum: Borç Sorgulama
    if (analysis.intent === "QUERY_DEBT") {
        if (!analysis.studentNo) {
            return "Borcunuzu sorgulayabilmem için öğrenci numaranızı yazmanız gerekiyor.";
        }
        
        try {
            console.log(`📡 API'ye Soruluyor (GET): /mobile/inquiry -> No: ${analysis.studentNo}`);
            const response = await axios.get(`${VIZE_API_URL}/api/v1/mobile/inquiry`, {
                params: { studentNo: analysis.studentNo }
            });
            const { studentName, totalDebt } = response.data;
            return `Sayın **${studentName}**, güncel toplam borcunuz: **${totalDebt} TL** dir.`;

        } catch (error) {
            console.error("⚠️ API Hatası:", error.message);
            return "Sorgulama başarısız. Öğrenci numarası hatalı olabilir veya sistemde kayıt bulunamadı.";
        }
    }

    // 3. Durum: Ödeme Yapma
    if (analysis.intent === "PAY_DEBT") {
        if (!analysis.studentNo || !analysis.amount) {
            return "Ödeme işlemi için **Öğrenci Numarası** ve **Miktar** belirtmelisiniz.";
        }

        try {
            console.log(`💳 İşlem Başlıyor: ${analysis.studentNo} için tutar: ${analysis.amount}`);
            const odenecekTutar = Number(analysis.amount);
           
            const { data: studentData, error: studentError } = await supabase
                .from('Student')
                .select('id')
                .eq('studentNo', analysis.studentNo)
                .single();

            if (studentError || !studentData) {
                console.log("❌ Öğrenci ID'si bulunamadı.");
                return `${analysis.studentNo} numaralı öğrenci sistemde kayıtlı değil.`;
            }

            const studentId = studentData.id; 

            
            const { data: tuitionData, error: fetchError } = await supabase
                .from('Tuition') 
                .select('balance') 
                .eq('studentId', studentId) 
                .single();

            if (fetchError || !tuitionData) {
                console.log("❌ Borç kaydı bulunamadı:", fetchError);
                return "Bu öğrenciye ait bir harç/borç kaydı bulunamadı.";
            }

            // Hesaplama kısmı
            const eskiBorc = Number(tuitionData.balance);
            const yeniBorc = eskiBorc - odenecekTutar;

            // ADIM 3: Güncellemeyi yap (Yine studentId kullanarak)
            const { error: updateError } = await supabase
                .from('Tuition')
                .update({ balance: yeniBorc }) 
                .eq('studentId', studentId);   

            if (updateError) {
                console.error("❌ Güncelleme Hatası:", updateError);
                return "Sistem hatası: Borç güncellenemedi.";
            }

            // ADIM 4: Makbuz için (payment tablsouna)
            await supabase.from('Payment').insert([
                {
                    studentNo: analysis.studentNo,
                    amount: odenecekTutar,
                    term: analysis.term || "Guz 2024",
                    date: new Date()
                }
            ]);

            return `✅ İşlem Başarılı!\n\n💰 **Ödenen:** ${odenecekTutar} TL\n📉 **Eski Borç:** ${eskiBorc} TL\n💳 **Kalan Borç:** ${yeniBorc} TL\n\nSisteme işlenmiştir.`;

        } catch (e) {
            console.error("Genel Hata:", e);
            return "Bir hata oluştu, lütfen tekrar deneyin.";
        }
    }

    return "Ne demek istediğinizi tam anlayamadım. 'Borcum ne?' gibi sorabilirsiniz.";
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
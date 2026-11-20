import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY belum diset di environment variables.' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Gambar tidak ditemukan.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const ai = new GoogleGenAI({ apiKey });

    const today = new Date().toISOString().split('T')[0];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: `Kamu adalah asisten pencatat keuangan pribadi di Indonesia.
Baca gambar struk belanja, invoice, atau screenshot bukti transfer (QRIS, BCA, Mandiri, BRI, GoPay, ShopeePay, dll) ini.
Ekstrak informasi berikut dalam format JSON:
- type: "inflow" jika uang masuk (transfer masuk, gaji, refund, terima dana), atau "outflow" jika uang keluar (belanja, bayar tagihan, transfer keluar, makan, cicilan). Default "outflow" jika ragu.
- amount: nominal angka bulat (tanpa Rp, titik, atau koma). Contoh: 50000.
- category: pilih satu kategori singkat yang paling cocok, misal: "Makan & Minum", "Belanja", "Transport", "Tagihan & Cicilan", "Gaji", "Transfer", "Lainnya".
- description: ringkasan singkat nama merchant/toko/pengirim/keperluan (maksimal 60 karakter).
- transaction_date: tanggal transaksi format YYYY-MM-DD. Jika tidak terlihat di gambar, gunakan "${today}".`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['inflow', 'outflow'] },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            transaction_date: { type: Type.STRING },
          },
          required: ['type', 'amount', 'category', 'description', 'transaction_date'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json(
        { error: 'AI tidak mengembalikan hasil.' },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(text);
    return NextResponse.json({ data: parsed });
  } catch (error) {
    console.error('Scan receipt error:', error);
    return NextResponse.json(
      { error: 'Gagal memproses gambar dengan AI.' },
      { status: 500 }
    );
  }
}

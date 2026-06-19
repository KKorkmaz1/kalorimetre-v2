/**
 * SEED LOCAL FOOD DATABASE — Turkish Foods
 * Source: USDA FoodData Central + Türkomp (Turkish Food Composition Database)
 * All values are PER 100g / 100ml unless noted in comments.
 *
 * Schema (compatible with existing FOOD_DB in foodData.js):
 *  id        : unique integer (100–199 range to avoid conflicts with existing 1-20)
 *  name      : Turkish display name
 *  calories  : kcal per 100g  (kept as "calories" for backward compat with calcPreview)
 *  protein   : g per 100g
 *  carbs     : g per 100g
 *  fat       : g per 100g
 *  fiber     : g per 100g   (extra field)
 *  sugar     : g per 100g   (extra field)
 *  units     : { "Label": multiplier }  — multiplier × qty × food.calories = kcal
 *              multiplier = gramsPerServing / 100
 *  tags      : dietary / allergen / health flags
 */

export const SEED_DB = [

  // ── KAHVALTILIKLAR ────────────────────────────────────────────────────────

  {
    id: 100, name: 'Simit',
    calories: 284, protein: 9.2, carbs: 54.7, fat: 3.2, fiber: 2.2, sugar: 3.5,
    units: { Gram: 0.01, Adet: 1.0 },
    tags: ['Vegan', 'Vejetaryen', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 101, name: 'Beyaz Peynir',
    calories: 264, protein: 14.2, carbs: 4.1, fat: 21.3, fiber: 0, sugar: 0.5,
    units: { Gram: 0.01, Dilim: 0.3 },
    tags: ['Vejetaryen', 'Glutensiz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein', 'Keto'],
  },
  {
    id: 102, name: 'Kaşar Peyniri',
    calories: 398, protein: 24.9, carbs: 1.3, fat: 32.2, fiber: 0, sugar: 0.5,
    units: { Gram: 0.01, Dilim: 0.25 },
    tags: ['Vejetaryen', 'Glutensiz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein', 'Keto'],
  },
  {
    id: 103, name: 'Zeytin (Siyah)',
    calories: 115, protein: 0.84, carbs: 6.3, fat: 10.9, fiber: 3.2, sugar: 0,
    units: { Gram: 0.01, Adet: 0.05 },
    tags: ['Vegan', 'Vejetaryen', 'Keto', 'Akdeniz', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 104, name: 'Bal',
    calories: 304, protein: 0.3, carbs: 82.4, fat: 0, fiber: 0.2, sugar: 82.1,
    units: { Gram: 0.01, 'Yemek Kaşığı': 0.2 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 105, name: 'Tereyağı',
    calories: 717, protein: 0.9, carbs: 0.1, fat: 80.8, fiber: 0, sugar: 0.1,
    units: { Gram: 0.01, 'Yemek Kaşığı': 0.1 },
    tags: ['Vejetaryen', 'Keto', 'Glutensiz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 106, name: 'Reçel',
    calories: 278, protein: 0.4, carbs: 68.9, fat: 0.1, fiber: 1.0, sugar: 48,
    units: { Gram: 0.01, 'Yemek Kaşığı': 0.2 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 107, name: 'Menemen',
    calories: 120, protein: 5.5, carbs: 5.2, fat: 8.2, fiber: 1.0, sugar: 3.5,
    units: { Gram: 0.01, Porsiyon: 2.5 },
    tags: ['Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Akdeniz'],
  },
  {
    id: 108, name: 'Omlet',
    calories: 154, protein: 10.6, carbs: 0.6, fat: 11.6, fiber: 0, sugar: 0.4,
    units: { Gram: 0.01, Adet: 0.8, Porsiyon: 1.5 },
    tags: ['Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Keto', 'Yüksek Protein'],
  },
  {
    id: 109, name: 'Poğaça (Peynirli)',
    calories: 350, protein: 9.5, carbs: 45, fat: 16, fiber: 1.5, sugar: 2,
    units: { Gram: 0.01, Adet: 0.8 },
    tags: ['Vejetaryen', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },

  // ── ET & TAVUK ────────────────────────────────────────────────────────────

  {
    id: 110, name: 'Döner (Tavuk)',
    calories: 150, protein: 22, carbs: 3, fat: 5.5, fiber: 0.3, sugar: 0.5,
    units: { Gram: 0.01, Porsiyon: 1.5 },
    tags: ['Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein'],
  },
  {
    id: 111, name: 'Döner (Et)',
    calories: 230, protein: 19.6, carbs: 2.8, fat: 15.4, fiber: 0.2, sugar: 0.5,
    units: { Gram: 0.01, Porsiyon: 1.5 },
    tags: ['Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein'],
  },
  {
    id: 112, name: 'Kuzu Pirzola (Izgara)',
    calories: 290, protein: 24.6, carbs: 0, fat: 20.8, fiber: 0, sugar: 0,
    units: { Gram: 0.01, Adet: 0.8, Porsiyon: 2.0 },
    tags: ['Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein', 'Keto'],
  },
  {
    id: 113, name: 'Hindi Göğsü (Izgara)',
    calories: 135, protein: 29.8, carbs: 0, fat: 1.5, fiber: 0, sugar: 0,
    units: { Gram: 0.01, Porsiyon: 1.5 },
    tags: ['Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein', 'Keto'],
  },
  {
    id: 114, name: 'Tavuk Kanat (Izgara)',
    calories: 203, protein: 18.4, carbs: 0, fat: 13.9, fiber: 0, sugar: 0,
    units: { Gram: 0.01, Adet: 0.5, Porsiyon: 2.0 },
    tags: ['Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein'],
  },
  {
    id: 115, name: 'Şiş Kebap',
    calories: 220, protein: 21.8, carbs: 2.5, fat: 14, fiber: 0.3, sugar: 0.5,
    units: { Gram: 0.01, Şiş: 1.0, Porsiyon: 2.0 },
    tags: ['Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein'],
  },
  {
    id: 116, name: 'Adana Kebap',
    calories: 280, protein: 19.7, carbs: 4.2, fat: 21, fiber: 0.5, sugar: 0.5,
    units: { Gram: 0.01, Porsiyon: 2.0 },
    tags: ['Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein'],
  },
  {
    id: 117, name: 'İskender Kebap',
    calories: 200, protein: 14, carbs: 15, fat: 10, fiber: 0.5, sugar: 1.5,
    units: { Gram: 0.01, Porsiyon: 3.5 },
    tags: ['Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein'],
  },

  // ── DENİZ ÜRÜNLERİ ────────────────────────────────────────────────────────

  {
    id: 118, name: 'Hamsi (Kızarmış)',
    calories: 185, protein: 21, carbs: 6, fat: 9, fiber: 0.2, sugar: 0,
    units: { Gram: 0.01, Porsiyon: 1.5 },
    tags: ['Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Yüksek Protein', 'Akdeniz'],
  },
  {
    id: 119, name: 'Levrek (Izgara)',
    calories: 124, protein: 24.2, carbs: 0, fat: 2.5, fiber: 0, sugar: 0,
    units: { Gram: 0.01, Porsiyon: 1.5, Adet: 3.0 },
    tags: ['Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Yüksek Protein', 'Akdeniz', 'Keto'],
  },
  {
    id: 120, name: 'Çipura (Izgara)',
    calories: 128, protein: 25.6, carbs: 0, fat: 2.8, fiber: 0, sugar: 0,
    units: { Gram: 0.01, Porsiyon: 1.5, Adet: 3.0 },
    tags: ['Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Yüksek Protein', 'Akdeniz', 'Keto'],
  },

  // ── TAHILLAR & EKMEK ──────────────────────────────────────────────────────

  {
    id: 121, name: 'Bulgur Pilavı',
    calories: 151, protein: 5.6, carbs: 30, fat: 1.3, fiber: 4.5, sugar: 0.4,
    units: { Gram: 0.01, Porsiyon: 2.0, 'Yemek Kaşığı': 0.15 },
    tags: ['Vegan', 'Vejetaryen', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif'],
  },
  {
    id: 122, name: 'Makarna (Haşlanmış)',
    calories: 131, protein: 5, carbs: 25.2, fat: 1.1, fiber: 1.8, sugar: 0.6,
    units: { Gram: 0.01, Porsiyon: 2.0, Kase: 1.5 },
    tags: ['Vegan', 'Vejetaryen', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 123, name: 'Beyaz Ekmek',
    calories: 265, protein: 9, carbs: 49.2, fat: 3.2, fiber: 2.7, sugar: 5,
    units: { Gram: 0.01, Dilim: 0.3 },
    tags: ['Vegan', 'Vejetaryen', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 124, name: 'Lavaş',
    calories: 275, protein: 9, carbs: 53, fat: 3, fiber: 2.5, sugar: 2,
    units: { Gram: 0.01, Adet: 0.6 },
    tags: ['Vegan', 'Vejetaryen', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },

  // ── ÇORBALAR ─────────────────────────────────────────────────────────────

  {
    id: 125, name: 'Domates Çorbası',
    calories: 48, protein: 1.6, carbs: 8, fat: 1.2, fiber: 1.2, sugar: 4.5,
    units: { Gram: 0.01, Kase: 2.5, Kepçe: 1.0 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Akdeniz'],
  },
  {
    id: 126, name: 'Tavuk Çorbası',
    calories: 15, protein: 1.8, carbs: 0.8, fat: 0.5, fiber: 0.2, sugar: 0.3,
    units: { Gram: 0.01, Kase: 2.5, Kepçe: 1.0 },
    tags: ['Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 127, name: 'Yayla Çorbası',
    calories: 70, protein: 3.5, carbs: 8.3, fat: 2.3, fiber: 0.3, sugar: 1,
    units: { Gram: 0.01, Kase: 2.5, Kepçe: 1.0 },
    tags: ['Vejetaryen', 'Glutensiz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 128, name: 'Ezogelin Çorbası',
    calories: 68, protein: 4, carbs: 11, fat: 1.2, fiber: 2.5, sugar: 0.8,
    units: { Gram: 0.01, Kase: 2.5, Kepçe: 1.0 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif', 'Düşük GI'],
  },

  // ── BAKLAGİLLER ──────────────────────────────────────────────────────────

  {
    id: 129, name: 'Mercimek (Haşlanmış)',
    calories: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9, sugar: 1.8,
    units: { Gram: 0.01, Porsiyon: 2.0, Kase: 1.5 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif', 'Düşük GI', 'Yüksek Protein'],
  },

  // ── SEBZELER ─────────────────────────────────────────────────────────────

  {
    id: 130, name: 'Domates',
    calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, sugar: 2.6,
    units: { Gram: 0.01, Adet: 1.2 },
    tags: ['Vegan', 'Vejetaryen', 'Akdeniz', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Düşük GI'],
  },
  {
    id: 131, name: 'Salatalık',
    calories: 15, protein: 0.65, carbs: 3.6, fat: 0.11, fiber: 0.5, sugar: 1.7,
    units: { Gram: 0.01, Adet: 2.0 },
    tags: ['Vegan', 'Vejetaryen', 'Akdeniz', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Düşük GI'],
  },
  {
    id: 132, name: 'Yeşil Biber',
    calories: 20, protein: 0.86, carbs: 4.6, fat: 0.17, fiber: 1.7, sugar: 2.4,
    units: { Gram: 0.01, Adet: 0.8 },
    tags: ['Vegan', 'Vejetaryen', 'Akdeniz', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Düşük GI'],
  },
  {
    id: 133, name: 'Patlıcan',
    calories: 25, protein: 0.98, carbs: 5.9, fat: 0.18, fiber: 3, sugar: 3.5,
    units: { Gram: 0.01, Porsiyon: 1.5, Adet: 2.0 },
    tags: ['Vegan', 'Vejetaryen', 'Akdeniz', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif', 'Düşük GI'],
  },
  {
    id: 134, name: 'Patates (Haşlanmış)',
    calories: 87, protein: 1.9, carbs: 20.1, fat: 0.1, fiber: 1.8, sugar: 0.9,
    units: { Gram: 0.01, Adet: 1.5, Porsiyon: 1.5 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 135, name: 'Havuç',
    calories: 41, protein: 0.93, carbs: 9.6, fat: 0.24, fiber: 2.8, sugar: 4.7,
    units: { Gram: 0.01, Adet: 0.8 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif', 'Düşük GI'],
  },

  // ── MEYVELER ─────────────────────────────────────────────────────────────

  {
    id: 136, name: 'Elma',
    calories: 52, protein: 0.26, carbs: 13.8, fat: 0.17, fiber: 2.4, sugar: 10.4,
    units: { Gram: 0.01, Adet: 1.8 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif', 'Düşük GI'],
  },
  {
    id: 137, name: 'Muz',
    calories: 89, protein: 1.09, carbs: 22.8, fat: 0.33, fiber: 2.6, sugar: 12.2,
    units: { Gram: 0.01, Adet: 1.2 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif'],
  },
  {
    id: 138, name: 'Portakal',
    calories: 47, protein: 0.94, carbs: 11.8, fat: 0.12, fiber: 2.4, sugar: 9.4,
    units: { Gram: 0.01, Adet: 1.8 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif', 'Düşük GI'],
  },
  {
    id: 139, name: 'Üzüm',
    calories: 69, protein: 0.72, carbs: 18.1, fat: 0.16, fiber: 0.9, sugar: 15.5,
    units: { Gram: 0.01, Salkım: 1.5 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 140, name: 'Karpuz',
    calories: 30, protein: 0.61, carbs: 7.6, fat: 0.15, fiber: 0.4, sugar: 6.2,
    units: { Gram: 0.01, Dilim: 3.0 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Düşük GI'],
  },
  {
    id: 141, name: 'Çilek',
    calories: 32, protein: 0.67, carbs: 7.7, fat: 0.3, fiber: 2, sugar: 4.9,
    units: { Gram: 0.01, Kase: 1.5 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif', 'Düşük GI'],
  },

  // ── SÜT ÜRÜNLERİ ─────────────────────────────────────────────────────────

  {
    id: 142, name: 'Ayran',
    // Per 100ml — diluted yogurt drink. Türkomp ref.
    calories: 36, protein: 2, carbs: 2.5, fat: 2, fiber: 0, sugar: 2.5,
    units: { Mililitre: 0.01, Bardak: 2.5 },
    tags: ['Vejetaryen', 'Glutensiz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 143, name: 'Kefir',
    calories: 52, protein: 3.8, carbs: 5.1, fat: 2, fiber: 0, sugar: 5,
    units: { Mililitre: 0.01, Bardak: 2.5 },
    tags: ['Vejetaryen', 'Glutensiz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein'],
  },
  {
    id: 144, name: 'Kaymak',
    calories: 338, protein: 3.4, carbs: 3.6, fat: 35.3, fiber: 0, sugar: 3.5,
    units: { Gram: 0.01, 'Yemek Kaşığı': 0.3 },
    tags: ['Vejetaryen', 'Glutensiz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Keto'],
  },

  // ── İÇECEKLER ────────────────────────────────────────────────────────────

  {
    id: 145, name: 'Türk Çayı (Şekersiz)',
    // Per 100ml brewed black tea, no sugar. Near-zero calorie. Türkomp ref.
    calories: 2, protein: 0, carbs: 0.4, fat: 0, fiber: 0, sugar: 0,
    units: { Mililitre: 0.01, Bardak: 1.0 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 146, name: 'Türk Kahvesi (Sade)',
    // Per 100ml prepared, no sugar. USDA black coffee ref.
    calories: 5, protein: 0.3, carbs: 0.6, fat: 0.1, fiber: 0, sugar: 0,
    units: { Mililitre: 0.01, Fincan: 0.6 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 147, name: 'Portakal Suyu (Taze)',
    calories: 45, protein: 0.7, carbs: 10.4, fat: 0.2, fiber: 0.2, sugar: 8.4,
    units: { Mililitre: 0.01, Bardak: 2.0 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },

  // ── TÜRK MUTFAĞI ÖZEL ─────────────────────────────────────────────────────

  {
    id: 148, name: 'Lahmacun',
    // Türkomp ref. 1 adet ≈ 120g
    calories: 218, protein: 10.9, carbs: 27.4, fat: 6.8, fiber: 1.8, sugar: 2,
    units: { Gram: 0.01, Adet: 1.2 },
    tags: ['Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 149, name: 'Pide (Kaşarlı)',
    calories: 280, protein: 12.5, carbs: 35, fat: 10, fiber: 1.5, sugar: 2,
    units: { Gram: 0.01, Dilim: 1.0, Porsiyon: 2.5 },
    tags: ['Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 150, name: 'Börek (Peynirli, Fırın)',
    // Türkomp ref. 1 dilim ≈ 80g
    calories: 328, protein: 11.8, carbs: 32.4, fat: 17.2, fiber: 1.2, sugar: 1.5,
    units: { Gram: 0.01, Dilim: 0.8 },
    tags: ['Vejetaryen', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 151, name: 'Gözleme (Peynirli)',
    calories: 282, protein: 10.8, carbs: 33.5, fat: 12.1, fiber: 1.5, sugar: 1.5,
    units: { Gram: 0.01, Adet: 1.5 },
    tags: ['Vejetaryen', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 152, name: 'Mantı',
    // Türkomp ref. 1 porsiyon ≈ 300g pişmiş.
    calories: 185, protein: 9.5, carbs: 24.6, fat: 5.4, fiber: 1.2, sugar: 1.5,
    units: { Gram: 0.01, Porsiyon: 3.0 },
    tags: ['Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 153, name: 'Yaprak Sarması',
    // Türkomp ref. 1 adet ≈ 30g
    calories: 180, protein: 5.8, carbs: 20.2, fat: 8.1, fiber: 2.2, sugar: 1,
    units: { Gram: 0.01, Adet: 0.3, Porsiyon: 1.5 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Akdeniz'],
  },
  {
    id: 154, name: 'İmam Bayıldı',
    calories: 65, protein: 1.5, carbs: 8.2, fat: 3.3, fiber: 3, sugar: 4,
    units: { Gram: 0.01, Porsiyon: 2.0 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Akdeniz'],
  },
  {
    id: 155, name: 'Karnıyarık',
    calories: 120, protein: 7.8, carbs: 9.8, fat: 5.8, fiber: 2.5, sugar: 3.5,
    units: { Gram: 0.01, Porsiyon: 2.0 },
    tags: ['Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Akdeniz'],
  },
  {
    id: 156, name: 'Dolma (Biber)',
    calories: 150, protein: 5, carbs: 20, fat: 6, fiber: 2, sugar: 2,
    units: { Gram: 0.01, Adet: 0.5, Porsiyon: 1.5 },
    tags: ['Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 157, name: 'Cacık',
    calories: 55, protein: 2.8, carbs: 3.5, fat: 2.9, fiber: 0.5, sugar: 2.5,
    units: { Gram: 0.01, Kase: 2.0 },
    tags: ['Vejetaryen', 'Glutensiz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Akdeniz'],
  },
  {
    id: 158, name: 'Piyaz',
    calories: 130, protein: 6.8, carbs: 17.8, fat: 3.8, fiber: 4.5, sugar: 2,
    units: { Gram: 0.01, Porsiyon: 2.0 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif'],
  },
  {
    id: 159, name: 'Çılbır',
    calories: 140, protein: 10, carbs: 2.8, fat: 9.5, fiber: 0.2, sugar: 0.5,
    units: { Gram: 0.01, Porsiyon: 1.8 },
    tags: ['Vejetaryen', 'Glutensiz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Keto', 'Yüksek Protein'],
  },

  // ── ATIŞTIRMALIKLAR ───────────────────────────────────────────────────────

  {
    id: 160, name: 'Cips (Patates)',
    calories: 536, protein: 7, carbs: 53, fat: 34, fiber: 4.8, sugar: 0.5,
    units: { Gram: 0.01, Paket: 0.5, 'Avuç dolusu': 0.3 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 161, name: 'Fıstık (Kavrulmuş)',
    calories: 567, protein: 25.8, carbs: 16.1, fat: 49.2, fiber: 8.5, sugar: 4,
    units: { Gram: 0.01, 'Avuç dolusu': 0.3 },
    tags: ['Vegan', 'Vejetaryen', 'Keto', 'Glutensiz', 'Laktozsuz', 'Deniz Ürünsüz', 'Yüksek Protein'],
  },
  {
    id: 162, name: 'Sütlü Çikolata',
    // USDA milk chocolate ref.
    calories: 535, protein: 7.6, carbs: 59.4, fat: 29.7, fiber: 3.4, sugar: 52,
    units: { Gram: 0.01, Kare: 0.05, Bar: 0.4 },
    tags: ['Vejetaryen', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 163, name: 'Bisküvi (Petit Beurre)',
    calories: 458, protein: 7.5, carbs: 65, fat: 18, fiber: 2.5, sugar: 20,
    units: { Gram: 0.01, Adet: 0.1 },
    tags: ['Vejetaryen', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
]

/**
 * Search the local seed database by name (case-insensitive, partial match).
 * Returns up to `limit` results.
 */
export function searchLocalDB(query, limit = 20) {
  if (!query || !query.trim()) return SEED_DB.slice(0, limit)
  const q = query.trim().toLowerCase()
  return SEED_DB.filter(f =>
    f.name.toLowerCase().includes(q) ||
    q.split(' ').every(word => f.name.toLowerCase().includes(word))
  ).slice(0, limit)
}

/**
 * "This sentence says the same thing in twenty languages", in the nineteen that are not English.
 * `upright` marks scripts that have no italic; `rtl` marks scripts written right to left.
 * @type {{code: string, name: string, text: string, upright?: boolean, rtl?: boolean}[]}
 */
export const TRANSLATIONS = [
  { code: 'es', name: 'Español', text: 'Esta frase dice lo mismo en veinte idiomas.' },
  { code: 'fr', name: 'Français', text: 'Cette phrase dit la même chose en vingt langues.' },
  { code: 'de', name: 'Deutsch', text: 'Dieser Satz sagt in zwanzig Sprachen dasselbe.' },
  { code: 'ja', name: '日本語', text: 'この文は二十の言語で同じことを言っています。', upright: true },
  { code: 'ar', name: 'العربية', text: 'هذه الجملة تقول الشيء نفسه بعشرين لغة.', upright: true, rtl: true },
  { code: 'ru', name: 'Русский', text: 'Это предложение говорит одно и то же на двадцати языках.' },
  { code: 'hi', name: 'हिन्दी', text: 'यह वाक्य बीस भाषाओं में एक ही बात कहता है।', upright: true },
  { code: 'pt', name: 'Português', text: 'Esta frase diz a mesma coisa em vinte línguas.' },
  { code: 'zh', name: '中文', text: '这句话用二十种语言说着同一件事。', upright: true },
  { code: 'el', name: 'Ελληνικά', text: 'Αυτή η πρόταση λέει το ίδιο πράγμα σε είκοσι γλώσσες.' },
  { code: 'it', name: 'Italiano', text: 'Questa frase dice la stessa cosa in venti lingue.' },
  { code: 'ko', name: '한국어', text: '이 문장은 스무 개의 언어로 같은 말을 합니다.', upright: true },
  { code: 'tr', name: 'Türkçe', text: 'Bu cümle yirmi dilde aynı şeyi söylüyor.' },
  { code: 'he', name: 'עברית', text: 'המשפט הזה אומר את אותו הדבר בעשרים שפות.', upright: true, rtl: true },
  { code: 'nl', name: 'Nederlands', text: 'Deze zin zegt hetzelfde in twintig talen.' },
  { code: 'pl', name: 'Polski', text: 'To zdanie mówi to samo w dwudziestu językach.' },
  { code: 'sv', name: 'Svenska', text: 'Den här meningen säger samma sak på tjugo språk.' },
  { code: 'vi', name: 'Tiếng Việt', text: 'Câu này nói cùng một điều bằng hai mươi ngôn ngữ.' },
  { code: 'sw', name: 'Kiswahili', text: 'Sentensi hii inasema jambo lilelile kwa lugha ishirini.' },
];

/**
 * Orders the translations for a reader, putting their own language first when it is listed.
 * @param {readonly string[]} preferred language tags, most wanted first, e.g. navigator.languages
 * @returns {typeof TRANSLATIONS}
 */
export function translationsFor(preferred) {
  for (const tag of preferred) {
    const own = TRANSLATIONS.find((t) => t.code === tag.toLowerCase().split('-')[0]);
    if (own) return [own, ...TRANSLATIONS.filter((t) => t !== own)];
  }
  return TRANSLATIONS;
}

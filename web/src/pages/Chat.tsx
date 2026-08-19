// Stage 6 placeholder — visual from day 0 so the product shape is complete.
// Will become: AI chat over the knowledge base (notes, files, records) with citations.
export default function Chat() {
  return (
    <div className="flex flex-col h-[calc(100dvh-180px)]">
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        <div className="bg-slate-800 rounded-2xl rounded-tl-md p-3 max-w-[85%] text-sm text-slate-300">
          Merhaba! Ben Şakül asistanı. Yakında notlarından, dosyalarından ve kayıtlarından soru
          cevaplayabileceğim:
          <ul className="mt-2 text-xs text-slate-400 flex flex-col gap-1">
            <li>“Demirciyle en son ne konuşmuştuk?”</li>
            <li>“Bu ay hangi çekler var?”</li>
            <li>“Yıldız Konutları'nın ruhsatı ne zaman bitiyor?”</li>
          </ul>
        </div>
        <div className="text-center text-xs text-slate-500 mt-4">
          🤖 Aşama 6'da aktif olacak
        </div>
      </div>
      <div className="flex gap-2 pt-3">
        <input
          disabled
          placeholder="Yakında…"
          className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-base text-slate-500"
        />
        <button disabled className="bg-slate-700/50 text-slate-500 rounded-xl px-4 text-sm">
          Gönder
        </button>
      </div>
    </div>
  );
}

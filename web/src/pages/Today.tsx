// Stage 1 placeholder — becomes the reminder digest screen in Stage 2.
export default function Today() {
  const today = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400 capitalize">{today}</p>
      <div className="bg-slate-800 rounded-xl p-6 text-center text-slate-400 text-sm">
        Hatırlatıcılar Aşama 2'de geliyor —<br />şimdilik Notlar ve Depo hazır 🎉
      </div>
    </div>
  );
}

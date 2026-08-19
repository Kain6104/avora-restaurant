export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-md">
      {/* Logo */}
      <img 
        src="/avora_logo_ngang.png" 
        alt="Avora Loading..." 
        className="h-20 lg:h-24 mb-6 object-contain animate-pulse drop-shadow-md" 
      />
      
      {/* 3 Dots Bouncing */}
      <div className="flex space-x-2.5">
        <div className="w-3 h-3 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '-0.3s' }}></div>
        <div className="w-3 h-3 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '-0.15s' }}></div>
        <div className="w-3 h-3 bg-red-600 rounded-full animate-bounce"></div>
      </div>
    </div>
  );
}

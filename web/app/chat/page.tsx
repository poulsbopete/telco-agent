import { TelcoAIChat } from "@/components/ui/telco-ai-chat";

const CHAT_BACKDROP =
  "linear-gradient(to bottom, rgba(10,10,11,0.94), rgba(10,10,11,0.98)), radial-gradient(ellipse 120% 80% at 50% 18%, rgba(226,0,116,0.16), transparent 55%), radial-gradient(ellipse 90% 55% at 85% 88%, rgba(63,185,80,0.08), transparent 50%)";

export default function ChatPage() {
  return (
    <div
      className="min-h-screen w-full overflow-x-hidden bg-[#0A0A0B] bg-cover bg-center"
      style={{ backgroundImage: CHAT_BACKDROP }}
    >
      <TelcoAIChat />
    </div>
  );
}

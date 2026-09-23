import { Menu, BookOpen, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function MobileNav({ onMenuClick }) {
  return (
    <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border sticky top-0 z-40">
      <Button variant="ghost" size="icon" onClick={onMenuClick}>
        <Menu className="w-5 h-5" />
      </Button>
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg object-cover" />
        <span className="font-bold text-sm">O meu Logbook</span>
      </div>
      <Link to="/notifications">
        <Button variant="ghost" size="icon">
          <Bell className="w-5 h-5" />
        </Button>
      </Link>
    </header>
  );
}
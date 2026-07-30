import { Home, Shirt, ArrowRightLeft, Trophy, Calendar, BarChart3, Award, Users, Star } from "lucide-react";

export const MAIN_NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/pick-team", label: "Pick Team", icon: Shirt },
  { href: "/transfers", label: "Transfers", icon: ArrowRightLeft },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/fixtures", label: "Fixtures", icon: Calendar },
  { href: "/statistics", label: "Stats", icon: BarChart3 },
  { href: "/achievements", label: "Achievements", icon: Award },
  { href: "/compare", label: "Compare", icon: Users },
  { href: "/all-time", label: "All-Time", icon: Star },
];

// Shown directly in the mobile bottom bar; the rest live under "More".
export const BOTTOM_NAV_PRIMARY = ["/", "/pick-team", "/transfers", "/leagues"];

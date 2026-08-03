"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Player, PlayerPosition } from "@/types";
import StatCard from "@/components/StatCard";
import FDRBadge from "@/components/FDRBadge";
import { ArrowRightLeft, Search, GitCompare, Gem } from "lucide-react";
import { teamAbbrev } from "@/lib/teamAbbrev";

interface EnrichedPlayer extends Player {
  ownershipPct: number;
  totalPoints: number;
  avgPoints: number;
  form: number;
  isDifferential: boolean;
  next5: { fdr: number; isHome: boolean; opponent?: string }[];
}

type SortKey = "price" | "points" | "form" | "ownership";

export default function TransfersPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [fantasyTeamId, setFantasyTeamId] = useState<string | null>(null);
  const [gameweekId, setGameweekId] = useState<string | null>(null);
  const [freeTransfers, setFreeTransfers] = useState(1);
  const [budgetRemaining, setBudgetRemaining] = useState(0);
  const [squad, setSquad] = useState<EnrichedPlayer[]>([]);
  const [allPlayers, setAllPlayers] = useState<EnrichedPlayer[]>([]);
  const [playerOut, setPlayerOut] = useState<EnrichedPlayer | null>(null);
  const [playerIn, setPlayerIn] = useState<EnrichedPlayer | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [clubFilter, setClubFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("form");
  const [isPreSeason, setIsPreSeason] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      const { data: team } = await supabase.from("fantasy_teams").select("*").eq("user_id", userData.user.id).single();
      if (!team) {
        router.push("/squad");
        return;
      }
      setFantasyTeamId(team.id);
      setFreeTransfers(team.free_transfers);
      setBudgetRemaining(team.budget_remaining);

      const { data: gw } = await supabase.from("gameweeks").select("*").in("status", ["upcoming", "open"]).order("number").limit(1).maybeSingle();
      if (gw) setGameweekId(gw.id);

      const { data: gw1 } = await supabase.from("gameweeks").select("deadline_at").eq("number", 1).maybeSingle();
      setIsPreSeason(gw1 ? new Date(gw1.deadline_at).getTime() > Date.now() : false);

      const [{ count: managerCount }, { data: pool }, { data: squadRows }, { data: ownershipRows }, { data: fpRows }, { data: fixtures }] =
        await Promise.all([
          supabase.from("fantasy_teams").select("*", { count: "exact", head: true }),
          supabase.from("players").select("*, team:teams(*)").eq("is_active", true),
          supabase.from("fantasy_squad_players").select("player_id").eq("fantasy_team_id", team.id),
          supabase.from("fantasy_squad_players").select("player_id"),
          supabase.from("fantasy_points").select("player_id, points, gameweek:gameweeks(number)"),
          supabase.from("fixtures").select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)").eq("is_final", false).order("kickoff_at", { ascending: true }),
        ]);

      const managers = managerCount || 1;
      const ownershipCount = new Map<string, number>();
      (ownershipRows ?? []).forEach((r: any) => ownershipCount.set(r.player_id, (ownershipCount.get(r.player_id) ?? 0) + 1));

      const pointsByPlayer = new Map<string, { number: number; points: number }[]>();
      (fpRows ?? []).forEach((r: any) => {
        const list = pointsByPlayer.get(r.player_id) ?? [];
        list.push({ number: r.gameweek?.number ?? 0, points: r.points });
        pointsByPlayer.set(r.player_id, list);
      });

      function enrich(p: Player): EnrichedPlayer {
        const ownershipPct = ((ownershipCount.get(p.id) ?? 0) / managers) * 100;
        const history = (pointsByPlayer.get(p.id) ?? []).sort((a, b) => b.number - a.number);
        const totalPoints = history.reduce((s, h) => s + h.points, 0);
        const avgPoints = history.length ? totalPoints / history.length : 0;
        const form = history.slice(0, 3).length ? history.slice(0, 3).reduce((s, h) => s + h.points, 0) / history.slice(0, 3).length : 0;
        const next5 = (fixtures ?? [])
          .filter((f: any) => f.home_team_id === p.team_id || f.away_team_id === p.team_id)
          .slice(0, 5)
          .map((f: any) => {
            const isHome = f.home_team_id === p.team_id;
            return { fdr: isHome ? f.home_fdr : f.away_fdr, isHome, opponent: isHome ? f.away_team?.name : f.home_team?.name };
          });
        return { ...p, ownershipPct, totalPoints, avgPoints, form, isDifferential: ownershipPct < 5, next5 };
      }

      const enrichedPool = (pool ?? []).map(enrich);
      setAllPlayers(enrichedPool as EnrichedPlayer[]);

      const squadIds = new Set((squadRows ?? []).map((r: any) => r.player_id));
      setSquad(enrichedPool.filter((p) => squadIds.has(p.id)));

      setLoading(false);
    }
    load();
  }, [supabase, router]);

  const clubs = useMemo(() => [...new Set(allPlayers.map((p) => p.team?.name).filter(Boolean))].sort(), [allPlayers]);

  const candidatesIn = useMemo(() => {
    if (!playerOut) return [];
    let list = allPlayers.filter((p) => p.position === playerOut.position && !squad.some((s) => s.id === p.id));
    if (search.trim()) list = list.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
    if (clubFilter) list = list.filter((p) => p.team?.name === clubFilter);
    list = [...list].sort((a, b) => {
      if (sortKey === "price") return a.price - b.price;
      if (sortKey === "points") return b.totalPoints - a.totalPoints;
      if (sortKey === "ownership") return b.ownershipPct - a.ownershipPct;
      return b.form - a.form;
    });
    return list;
  }, [allPlayers, squad, playerOut, search, clubFilter, sortKey]);

  const budgetAfterSwap = playerOut && playerIn ? budgetRemaining + playerOut.price - playerIn.price : budgetRemaining;
  const willBeFree = isPreSeason || freeTransfers > 0;
  const pointCost = willBeFree ? 0 : 3;

  async function confirmTransfer() {
    if (!fantasyTeamId || !gameweekId || !playerOut || !playerIn) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fantasy_team_id: fantasyTeamId,
        gameweek_id: gameweekId,
        player_out_id: playerOut.id,
        player_in_id: playerIn.id,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(body.error ?? "Couldn't complete the transfer.");
      return;
    }
    setSquad(squad.map((p) => (p.id === playerOut.id ? playerIn : p)));
    setBudgetRemaining(body.budget_remaining);
    setFreeTransfers(body.free_transfers);
    setPlayerOut(null);
    setPlayerIn(null);
    setMessage("Transfer complete!");
  }

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-10 text-slate-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <h1 className="font-display text-2xl font-black text-slate-900">Transfers</h1>

      {isPreSeason && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-bold text-emerald-700">
          Unlimited free transfers until the Gameweek 1 deadline — build your squad freely, no cost.
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Squad value" value={`${squad.reduce((s, p) => s + p.price, 0).toFixed(1)}M`} accent="emerald" />
        <StatCard label="In the bank" value={`${budgetRemaining.toFixed(1)}M`} />
        <StatCard label="Free transfers" value={isPreSeason ? "∞" : freeTransfers} accent="emerald" />
        <StatCard label="Extra transfer cost" value={isPreSeason ? "Free" : "-3 pts"} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Unused transfers roll over (max 3 saved). Extra transfers beyond your free ones cost 3 points each.
      </p>

      <h2 className="mt-6 text-sm font-bold text-slate-500">1. Choose player out</h2>
      <div className="mt-2 space-y-2">
        {squad.map((p) => (
          <RichPlayerRow key={p.id} player={p} selected={playerOut?.id === p.id} onClick={() => { setPlayerOut(p); setPlayerIn(null); }} />
        ))}
      </div>

      {playerOut && (
        <>
          <h2 className="mt-6 text-sm font-bold text-slate-500">2. Choose player in ({playerOut.position})</h2>

          <div className="mt-2 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[140px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search players…"
                className="w-full rounded-lg border border-pitch-border bg-pitch-surface py-2 pl-8 pr-3 text-sm text-slate-900 outline-none focus:border-slate-900"
              />
            </div>
            <select value={clubFilter} onChange={(e) => setClubFilter(e.target.value)} className="rounded-lg border border-pitch-border bg-pitch-surface px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900">
              <option value="">All clubs</option>
              {clubs.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="rounded-lg border border-pitch-border bg-pitch-surface px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900">
              <option value="form">Sort: Form</option>
              <option value="points">Sort: Total points</option>
              <option value="price">Sort: Price</option>
              <option value="ownership">Sort: Ownership</option>
            </select>
          </div>

          <div className="mt-2 space-y-2">
            {candidatesIn.map((p) => {
              const wouldExceedBudget = budgetRemaining + playerOut.price - p.price < 0;
              return (
                <RichPlayerRow
                  key={p.id}
                  player={p}
                  selected={playerIn?.id === p.id}
                  disabled={wouldExceedBudget}
                  onClick={() => setPlayerIn(p)}
                  compareHref={`/compare?left=${playerOut.id}&right=${p.id}`}
                />
              );
            })}
            {candidatesIn.length === 0 && <p className="text-sm text-slate-500">No players match your filters.</p>}
          </div>
        </>
      )}

      {playerOut && playerIn && (
        <div className="mt-6 rounded-xl border border-pitch-border bg-pitch-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ArrowRightLeft size={16} className="text-emerald-700" />
            {playerOut.name} → {playerIn.name}
          </div>
          <div className="mt-2 text-sm text-slate-500">Budget after swap: {budgetAfterSwap.toFixed(1)}M</div>
          <div className="text-sm text-slate-500">
            Cost: {willBeFree ? "Free transfer" : `-${pointCost} points (no free transfers left)`}
            {isPreSeason && " — unlimited before Gameweek 1"}
          </div>
          {message && <p className="mt-2 text-xs text-emerald-600">{message}</p>}
          <button
            onClick={confirmTransfer}
            disabled={saving || budgetAfterSwap < 0}
            className="mt-3 w-full rounded-xl bg-emerald-500 py-2.5 font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {saving ? "Confirming…" : "Confirm transfer"}
          </button>
        </div>
      )}
    </div>
  );
}

const POS_COLOR: Record<string, string> = {
  GK: "bg-amber-50 text-amber-700 border-amber-200",
  DEF: "bg-sky-50 text-sky-700 border-sky-200",
  MID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FWD: "bg-rose-50 text-rose-700 border-rose-200",
};

function RichPlayerRow({
  player,
  selected,
  disabled,
  onClick,
  compareHref,
}: {
  player: EnrichedPlayer;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  compareHref?: string;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 transition ${
        selected ? "border-emerald-500/40 bg-emerald-500/10" : disabled ? "border-pitch-border bg-pitch-surface/40 opacity-40" : "border-pitch-border bg-pitch-surface"
      }`}
    >
      <button onClick={onClick} disabled={disabled} className="flex w-full items-center justify-between text-left">
        <div className="flex items-center gap-3">
          <span className={`rounded-md border px-2 py-1 text-[10px] font-bold ${POS_COLOR[player.position]}`}>{player.position}</span>
          <div>
            <div className="flex items-center gap-1 text-sm font-semibold text-slate-900">
              {player.name}
              {player.isDifferential && <Gem size={12} className="text-emerald-700" />}
            </div>
            <div className="text-xs text-slate-500">
              {player.team?.name} ({teamAbbrev(player.team?.name)}) · {player.ownershipPct.toFixed(1)}% owned · form {player.form.toFixed(1)}
            </div>
          </div>
        </div>
        <span className="font-mono text-sm text-slate-700">{player.price.toFixed(1)}M</span>
      </button>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-1">
          {player.next5.map((f, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <FDRBadge rating={f.fdr} />
              <span className="text-[9px] text-slate-400">{f.isHome ? "H" : "A"}</span>
            </div>
          ))}
          {player.next5.length === 0 && <span className="text-[11px] text-slate-400">No fixtures scheduled</span>}
        </div>
        {compareHref && (
          <Link href={compareHref} className="flex items-center gap-1 rounded-md bg-slate-100 border border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-600">
            <GitCompare size={11} /> Compare
          </Link>
        )}
      </div>
    </div>
  );
}

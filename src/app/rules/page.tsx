export default function RulesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-16">
      <h1 className="font-display text-2xl font-black text-slate-900">Rules</h1>
      <p className="mt-1 text-sm text-slate-500">Everything that decides how points, squads, and the season work.</p>

      <Section title="Squad Rules">
        <List
          items={[
            "Each manager owns 15 players: 2 GK, 5 DEF, 5 MID, 3 FWD.",
            "Maximum 4 players from the same real-life team.",
            "Minimum 2 players from Gullhaug Team 1 and 2 from Gullhaug Team 2.",
            "Every player has a fixed price for the season — prices never change mid-season.",
          ]}
        />
      </Section>

      <Section title="Starting XI & Formations">
        <List
          items={[
            "Valid formations: 3-4-3, 3-5-2, 4-4-2, 4-3-3, 4-5-1, 5-3-2, 5-4-1.",
            "Every formation needs at least 3 defenders, 3 midfielders, and 1 forward.",
            "Managers choose a Captain and Vice Captain from their Starting XI.",
            "Captain's points are doubled. If the Captain doesn't play, the Vice Captain's points are doubled instead.",
            "4 substitutes on the bench, in order. Automatic substitutions happen if a starter doesn't play.",
          ]}
        />
      </Section>

      <Section title="Rolling Captain & Rolling Substitutions">
        <List
          items={[
            "Captain can be changed during a live gameweek, but only to a player whose match hasn't kicked off yet.",
            "Once a player's match starts, they can no longer become Captain.",
            "Substitutions can be made during a live gameweek: a starter (even one who already played) can be swapped for a bench player whose match hasn't started yet.",
            "Every substitution must still leave a valid formation.",
          ]}
        />
      </Section>

      <Section title="Scoring — All Positions">
        <List items={["+1 point for appearing in a match.", "Yellow card: −1 point.", "Red card: −3 points.", "Own goal: −2 points."]} />
      </Section>

      <Section title="Scoring — Goalkeepers">
        <List
          items={[
            "Goal: +20 points.",
            "Assist: +5 points (Gullhaug players only).",
            "Clean sheet: +5 points.",
            "Goals conceded: −1 for every 2 conceded, then −1 for every additional 3 conceded after the 4th.",
          ]}
        />
        <ConcededTable />
      </Section>

      <Section title="Scoring — Defenders">
        <List
          items={[
            "Goal: +8 points.",
            "Assist: +5 points (Gullhaug players only).",
            "Clean sheet: +4 points.",
            "Same goals-conceded deduction as goalkeepers.",
          ]}
        />
      </Section>

      <Section title="Scoring — Midfielders">
        <List items={["Goal: +6 points.", "Assist: +3 points (Gullhaug players only).", "Clean sheet: +1 point."]} />
      </Section>

      <Section title="Scoring — Forwards">
        <List items={["Goal: +5 points.", "Assist: +3 points (Gullhaug players only).", "No clean sheet points."]} />
      </Section>

      <Section title="Bonus Goal Scoring">
        <List
          items={[
            "Hat-trick (3+ goals in one match): +2 bonus points on top of normal goal points.",
            "5+ goals in one match: an additional +3 bonus points (on top of the hat-trick bonus).",
            "A player scoring 5 goals in a match receives both bonuses.",
          ]}
        />
      </Section>

      <Section title="Why only Gullhaug assists?">
        <p className="text-sm text-slate-500">
          Assist data isn't available for every club we play against, so to keep things fair, assists are only ever
          tracked and awarded for Gullhaug Team 1 and Gullhaug Team 2 players. Every other position's assist points
          are simply 0, regardless of team.
        </p>
      </Section>

      <Section title="Scouting Bonus">
        <List
          items={[
            "If a player is owned by less than 5% of managers AND scores at least 5 fantasy points in a gameweek, they earn a +2 bonus.",
          ]}
        />
      </Section>

      <Section title="Transfers">
        <List
          items={[
            "1 free transfer every gameweek.",
            "Unused free transfers roll over, up to a maximum of 3 saved.",
            "Extra transfers beyond your free ones cost −3 points each.",
          ]}
        />
      </Section>

      <Section title="Chips">
        <List
          items={[
            "Each chip can be used once per season.",
            "Wildcard: unlimited free transfers for one gameweek.",
            "Goal Rush: every goal your players score is worth +2 extra points that gameweek.",
            "Super Defence: goalkeepers and defenders get +2 extra clean sheet points that gameweek.",
            "Away Advantage: players in your Starting XI playing away who win get +2 points.",
          ]}
        />
      </Section>

      <Section title="Double Gameweeks">
        <List
          items={[
            "If a postponed fixture is moved into a gameweek where a team already has another match, both fixtures count.",
            "Points from both matches are added together for every player involved.",
            "Captain doubling applies across the combined total from both matches.",
            "An active chip stays active for both matches.",
            "Clean sheets, goals, assists, and cards are calculated separately per match, then summed.",
          ]}
        />
      </Section>

      <Section title="Team of the Week">
        <List
          items={[
            "Generated automatically after every completed gameweek.",
            "Picks the highest-scoring valid XI across all managers' squads that gameweek.",
            "Archived permanently so you can browse any previous gameweek's Team of the Week.",
          ]}
        />
      </Section>

      <Section title="Achievements & Weekly Awards">
        <p className="text-sm text-slate-500">
          Achievements are permanent, one-time unlocks (see the Achievements page for the full list). Weekly Awards
          are generated fresh every gameweek — Manager of the Week, Captain of the Week, Best Differential, Best
          Defence, Highest Attack, and Unluckiest Manager.
        </p>
      </Section>

      <Section title="Fixture Difficulty Rating (FDR)">
        <p className="text-sm text-slate-500">Every fixture is rated 1 (easiest) to 5 (hardest) for each side:</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
          <span className="fdr-1 rounded-md border px-2 py-1">1 Very easy</span>
          <span className="fdr-2 rounded-md border px-2 py-1">2 Easy</span>
          <span className="fdr-3 rounded-md border px-2 py-1">3 Average</span>
          <span className="fdr-4 rounded-md border px-2 py-1">4 Difficult</span>
          <span className="fdr-5 rounded-md border px-2 py-1">5 Very difficult</span>
        </div>
      </Section>

      <Section title="Budget">
        <p className="text-sm text-slate-500">
          Every manager starts with the same budget (set by the admin before the season — see Admin → Gameweeks).
          Player prices are fixed for the whole season and never change.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="font-display text-lg font-bold text-slate-900">{title}</h2>
      <div className="mt-2 rounded-xl border border-pitch-border bg-pitch-surface p-4">{children}</div>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-slate-700">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-emerald-700">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ConcededTable() {
  const rows = [
    [0, "+5"], [1, "0"], [2, "−1"], [3, "−1"], [4, "−2"], [5, "−2"], [6, "−2"], [7, "−3"],
  ] as const;
  return (
    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs sm:grid-cols-8">
      {rows.map(([conceded, points]) => (
        <div key={conceded} className="rounded-lg bg-pitch px-2 py-1.5">
          <div className="text-slate-500">{conceded} conceded</div>
          <div className="font-mono font-bold text-slate-900">{points}</div>
        </div>
      ))}
    </div>
  );
}

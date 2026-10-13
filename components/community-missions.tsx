"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Droplets, ArrowRight } from "lucide-react";
import { communityAction } from "@/lib/community-client";
import {
  DAILY_RESET,
  suggestionCategories,
  type SuggestionCategory,
} from "@/lib/community";
import type { Card } from "@/lib/catalog";

type Option = { id: string; label: string; votes?: number };
type Poll = {
  id: string;
  title: string;
  state: string;
  closes_at: string | null;
  reward_enabled: boolean;
  vote?: string;
  claimed?: boolean;
  options: Option[];
};
type Character = {
  id: string;
  name: string;
  sfw: number;
  adult: number;
  my_sfw: boolean;
  my_adult: boolean;
};
type Request = {
  id: string;
  title: string;
  author?: string;
  related?: string;
  status: string;
  support: number;
  requested: number;
  supported: boolean;
  characters?: Character[];
};
type PublicData = { requests: Request[]; artwork: Request[]; polls: Poll[] };
type Status = {
  day: string;
  claims: string[];
  legacy: string[];
  showcase: string[];
  eligible_slots: number;
};
const empty: PublicData = { requests: [], artwork: [], polls: [] };
const missionNames: Record<string, string> = {
  daily: "Free Ink. Because you showed up.",
  studio: "Share the obsession.",
  suggestion: "Community suggestion",
  "showcase:first": "Show off your favorites.",
  "showcase:six": "The inner circle.",
  favorite: "Mark your favorite",
  pack: "Rip your first pack",
  discover: "Meet your next obsession",
  vote: "Demand your next obsession",
  poll: "Creator poll",
  mastery: "Collection mastery",
};
function completedLabel(key: string) {
  const name =
    missionNames[key] ??
    missionNames[key.split(":")[0]] ??
    (key.startsWith("visit-") ? missionNames.daily : "Collector achievement");
  const date = key.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return `${name}${date ? " · " + date : ""}`;
}
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Could not save. Please try again.";
export default function CommunityMissions({
  mode,
  signedIn,
  cards = [],
  owned = [],
  legacyCompleted = [],
}: {
  mode: "quests" | "requests";
  signedIn: boolean;
  cards?: Card[];
  owned?: string[];
  legacyCompleted?: string[];
}) {
  const [data, setData] = useState<PublicData>(empty),
    [status, setStatus] = useState<Status | null>(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [category, setCategory] = useState<SuggestionCategory>("book"),
    [title, setTitle] = useState(""),
    [query, setQuery] = useState(""),
    [slots, setSlots] = useState<string[]>([]);
  const slotsDirty = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const pub = await communityAction("public");
      setData(pub as unknown as PublicData);
      if (signedIn) {
        const next = await communityAction("status");
        setStatus(next as unknown as Status);
        if (!slotsDirty.current) setSlots((next.showcase ?? []) as string[]);
      }
      setLoaded(true);
    } catch (e) {
      setNotice(errorText(e));
      setLoaded(false);
    }
  }, [signedIn]);
  useEffect(() => {
    void refresh();
    const update = () => {
      void refresh();
    };
    window.addEventListener("focus", update);
    const timer = setInterval(update, 60000);
    return () => {
      window.removeEventListener("focus", update);
      clearInterval(timer);
    };
  }, [refresh]);
  async function run(
    op: string,
    payload: Record<string, unknown>,
    message: string,
  ) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await communityAction(op, payload);
      if (op === "showcase") slotsDirty.current = false;
      setNotice(
        `${message}${result.awarded ? ` +${result.awarded} Ink added!` : ""}`,
      );
      await refresh();
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const claims = [...(status?.claims ?? []), ...(status?.legacy ?? [])];
  const day = status?.day ?? new Date().toISOString().slice(0, 10);
  const claimed = (key: string) =>
    claims.includes(key) ||
    (key === `daily:${day}` && claims.includes(`visit-${day}`));
  const matches = [...data.requests, ...data.artwork]
    .filter(
      (r) =>
        title.trim().length > 2 &&
        (r.title + " " + (r.characters?.map((c) => c.name).join(" ") ?? ""))
          .toLowerCase()
          .includes(title.trim().toLowerCase()),
    )
    .slice(0, 4);
  const cat = suggestionCategories.find((c) => c.id === category)!;
  const mission = (
    key: string,
    name: string,
    text: string,
    reward: number,
    eligible: boolean,
    href?: string,
    progress?: string,
  ) => (
    <article className="quest-card" key={key}>
      <Droplets size={24} />
      <h3>{name}</h3>
      <p>{text}</p>
      {progress && <small>{progress}</small>}
      <div className="quest-action">
        <span>{reward} Ink</span>
        {claimed(key) ? (
          <span className="claimed">
            <Check size={16} />
            Claimed
          </span>
        ) : href ? (
          <Link className="button outline" href={href}>
            Open Studio <ArrowRight size={14} />
          </Link>
        ) : (
          <button
            className="button gold"
            disabled={!signedIn || busy || !loaded || !eligible}
            onClick={() =>
              run(
                "claim",
                { key: key.startsWith("daily:") ? "daily" : key },
                "Mission claimed.",
              )
            }
          >
            Claim reward
          </button>
        )}
      </div>
      {key.includes(day) && <small>Resets daily at {DAILY_RESET}</small>}
    </article>
  );
  const suggestions = (
    <section className="community-suggestions">
      <div className="section-title">
        <h2>Community suggestions</h2>
        <span className="muted">25 Ink · once daily across all ideas</span>
      </div>
      <div className="panel">
        <h3>Who’s missing?</h3>
        <p>Tell us which fictional obsession we need next.</p>
        <div className="button-row">
          {suggestionCategories.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`button ${category === c.id ? "gold" : "outline"}`}
              onClick={() => {
                setCategory(c.id);
                setTitle("");
              }}
            >
              {c.title}
            </button>
          ))}
        </div>
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            if (busy) return;
            setBusy(true);
            try {
              const result = await communityAction("submit", {
                category,
                title,
                related: String(f.get("related") ?? ""),
                notes: String(f.get("notes") ?? ""),
              });
              setNotice(
                `Idea saved privately.${result.awarded ? " +25 Ink added!" : result.eligible === false ? " This submission is not eligible for Ink." : " Your daily suggestion reward has already been claimed."}`,
              );
              setTitle("");
              form.reset();
              await refresh();
            } catch (err) {
              setNotice(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>{cat.title}</h3>
          <label>
            {cat.field}
            <input
              required
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          {matches.length > 0 && (
            <div className="suggestion-matches">
              <strong>Already on the shelf?</strong>
              {matches.map((r) => (
                <p key={r.id}>
                  <Link href="/requests">
                    {r.title} · {r.support} supporters
                  </Link>
                </p>
              ))}
              <small>You can still send your own idea.</small>
            </div>
          )}
          <label>
            {cat.related}
            <input
              key={category}
              name="related"
              required={category === "character"}
              maxLength={150}
            />
          </label>
          <label>
            Additional notes (optional)
            <textarea name="notes" maxLength={2000} />
          </label>
          <button
            disabled={!signedIn || busy || !loaded}
            className="button gold"
          >
            Send idea
            {claimed(`suggestion:${day}`)
              ? " · daily reward claimed"
              : " · first eligible idea earns 25 Ink"}
          </button>
        </form>
        <p className="footnote">
          Send as many sincere ideas as you like. Suggestions stay private until
          approved for public voting. A suggestion is not a promise of
          production. Daily rewards reset at {DAILY_RESET}.
        </p>
      </div>
    </section>
  );
  const polls = (
    <section>
      <div className="section-title">
        <h2>Creator polls</h2>
        <span className="muted">25 Ink once per eligible poll</span>
      </div>
      {data.polls.length ? (
        data.polls.map((p) => {
          const open =
            p.state === "open" &&
            (!p.closes_at || new Date(p.closes_at) > new Date());
          return (
            <article key={p.id} className="panel">
              <p className="eyebrow">
                FROM THE CREATOR · {open ? "OPEN" : "CLOSED"}
              </p>
              <h3>{p.title}</h3>
              <p>
                {open
                  ? "Your vote helps choose what gets made next. Change it until closing."
                  : "Voting has closed. Thanks for shaping the shelf."}
              </p>
              <div className="button-row">
                {p.options.map((o) => (
                  <button
                    disabled={!signedIn || busy || !open}
                    key={o.id}
                    className={`button ${p.vote === o.id ? "gold" : "outline"}`}
                    aria-pressed={p.vote === o.id}
                    onClick={() =>
                      run(
                        "poll_vote",
                        { poll: p.id, option: o.id },
                        "Vote saved.",
                      )
                    }
                  >
                    {p.vote === o.id && <Check size={15} />} {o.label}
                  </button>
                ))}
              </div>
              <p className="footnote">
                {p.reward_enabled
                  ? p.claimed
                    ? "25 Ink claimed"
                    : "25 Ink for your first vote"
                  : "Community poll"}
                {p.closes_at
                  ? ` · Closes ${new Date(p.closes_at).toLocaleString()}`
                  : " · Open until the creator closes it"}
              </p>
            </article>
          );
        })
      ) : (
        <div className="panel">
          <p>The creator is dreaming up the next question. Check back soon.</p>
        </div>
      )}
    </section>
  );
  return (
    <div className="community-missions">
      {notice && (
        <p className="panel mission-notice" role="status">
          {notice}
        </p>
      )}
      {!signedIn && (
        <p className="panel">
          Browse the community, then{" "}
          <Link href={`/login?next=/${mode}`}>sign in</Link> to earn Ink,
          suggest ideas, and vote.
        </p>
      )}
      {mode === "quests" ? (
        <>
          <div className="page-heading">
            <div>
              <p className="eyebrow">FREE INK · EASY WINS</p>
              <h1>Fund the obsession.</h1>
              <p>Do tiny collector things. Get Ink. Rip more packs.</p>
            </div>
          </div>
          <section>
            <div className="section-title">
              <h2>Daily missions</h2>
              <span className="muted">
                Resets at {DAILY_RESET} · no streaks
              </span>
            </div>
            <div className="quest-grid">
              {mission(
                `daily:${day}`,
                "Free Ink. Because you showed up.",
                "Claim 100 Ink. No streaks. No guilt trip.",
                100,
                true,
              )}
              {mission(
                `studio:${day}`,
                "Share the obsession.",
                "Turn your favorite characters into something worth sharing.",
                100,
                false,
                "/showcase/create",
              )}
            </div>
            <p className="footnote">
              Story, Square, or Landscape. Reuse your favorite artwork. PNG
              creation and browser download handoff count; posting on Instagram
              is optional.
            </p>
          </section>
          <section>
            <div className="section-title">
              <h2>Showcase milestones</h2>
              <span className="muted">One time · yours forever</span>
            </div>
            <div className="quest-grid">
              {mission(
                "showcase:first",
                "Show off your favorites.",
                "Give your favorite character the spotlight.",
                50,
                (status?.eligible_slots ?? 0) >= 1,
                undefined,
                `${Math.min(status?.eligible_slots ?? 0, 1)}/1 owned card`,
              )}
              {mission(
                "showcase:six",
                "The inner circle.",
                "Fill all six spots in your showcase.",
                50,
                (status?.eligible_slots ?? 0) >= 6,
                undefined,
                `${status?.eligible_slots ?? 0}/6 owned cards`,
              )}
            </div>
            <details className="panel">
              <summary>Edit your six-card showcase</summary>
              <p>
                Pick owned characters. Removing or replacing them keeps earned
                milestones.
              </p>
              <div className="showcase-slot-editor">
                {Array.from({ length: 6 }, (_, i) => (
                  <label key={i}>
                    Spot {i + 1}
                    <select
                      value={slots[i] ?? ""}
                      onChange={(e) => {
                        const next = Array.from(
                          { length: 6 },
                          (_, n) => slots[n] ?? "",
                        );
                        next[i] = e.target.value;
                        slotsDirty.current = true;
                        setSlots(next);
                      }}
                    >
                      <option value="">Choose a favorite</option>
                      {cards
                        .filter(
                          (c) =>
                            owned.includes(c.id) ||
                            owned.includes(`${c.id}:foil`),
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
              <button
                className="button gold"
                disabled={!signedIn || busy || !loaded}
                onClick={() =>
                  run(
                    "showcase",
                    { cards: slots.filter(Boolean) },
                    "Showcase saved.",
                  )
                }
              >
                Save showcase
              </button>
            </details>
          </section>
          {suggestions}
          {polls}
          <section>
            <div className="section-title">
              <h2>Completed missions</h2>
              <span className="muted">A little collector history</span>
            </div>
            <div className="panel">
              {[...new Set([...claims, ...legacyCompleted])].length ? (
                <ul>
                  {[...new Set([...claims, ...legacyCompleted])].map((key) => (
                    <li key={key}>
                      <Check size={14} /> {completedLabel(key)} · completed
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Your completed missions will stay here.</p>
              )}
              <p className="footnote">
                Earlier browser achievements are retained as history. Browser
                records cannot grant account Ink.
              </p>
            </div>
            <div className="quest-grid">
              {mission(
                "favorite",
                "Mark your favorite",
                "Heart an owned character you would absolutely chase.",
                50,
                true,
              )}
              {mission(
                "pack",
                "Rip your first pack",
                "Open four cards and get your guaranteed foil.",
                50,
                true,
              )}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <p className="eyebrow">YOU WANT THEM · WE CARD THEM</p>
              <h1>Who belongs in a pack next?</h1>
              <p>
                Drop the book. Name the obsession. Let collectors make some
                noise.
              </p>
            </div>
          </div>
          <label className="search">
            <input
              aria-label="Search approved suggestions"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search characters, books, or artwork"
            />
          </label>
          <div className="request-list">
            {[...data.requests, ...data.artwork]
              .filter((r) =>
                (
                  r.title +
                  " " +
                  r.author +
                  " " +
                  r.related +
                  " " +
                  r.characters?.map((c) => c.name).join(" ")
                )
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .sort((a, b) => b.support - a.support)
              .map((r) => (
                <article className="request-card" key={r.id}>
                  <div className="request-book">
                    <div>
                      <span className="status">{r.status}</span>
                      <h2>{r.title}</h2>
                      <p>{r.author || r.related}</p>
                      <small>
                        {r.requested} requests · {r.support} supporters
                      </small>
                    </div>
                    <button
                      disabled={!signedIn || busy}
                      className={`button ${r.supported ? "gold" : "outline"}`}
                      onClick={() =>
                        run(
                          "support",
                          {
                            id: r.id,
                            kind: r.characters ? "book" : "artwork",
                            enabled: !r.supported,
                          },
                          "Support updated.",
                        )
                      }
                    >
                      {r.supported ? "Supported ✓" : "Support"}
                    </button>
                  </div>
                  <div className="character-votes">
                    {r.characters?.map((c) => (
                      <div key={c.id}>
                        <strong>{c.name}</strong>
                        {(["sfw", "adult"] as const).map((rating) => (
                          <button
                            disabled={!signedIn || busy}
                            key={rating}
                            aria-pressed={c[`my_${rating}`]}
                            className={
                              c[`my_${rating}`] ? "vote voted" : "vote"
                            }
                            onClick={() =>
                              run(
                                "support",
                                {
                                  id: c.id,
                                  kind: "character",
                                  rating,
                                  enabled: !c[`my_${rating}`],
                                },
                                "Vote updated.",
                              )
                            }
                          >
                            ↑ {c[rating]}{" "}
                            <span>
                              {rating === "sfw" ? "SFW" : "After Dark interest"}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
          </div>
          {loaded && !data.requests.length && !data.artwork.length && (
            <p className="panel">
              The next chapter starts with your idea. Approved requests will
              appear here.
            </p>
          )}
          {suggestions}
        </>
      )}
    </div>
  );
}

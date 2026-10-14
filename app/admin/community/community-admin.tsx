"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CREATOR_POLL_PRESETS } from "@/lib/creator-poll-presets";
import { communityAction } from "@/lib/community-client";
type Submission = {
  id: string;
  category: string;
  title: string;
  related: string;
  notes: string;
  status: string;
  duplicates: number;
  merged_into: string | null;
  book_request_id: string | null;
  created_at: string;
};
type Poll = {
  id: string;
  title: string;
  state: string;
  closes_at: string | null;
  options: { id: string; label: string; votes: number }[];
};
export default function CommunityAdmin() {
  const [submissions, setSubmissions] = useState<Submission[]>([]),
    [polls, setPolls] = useState<Poll[]>([]),
    [category, setCategory] = useState("all"),
    [status, setStatus] = useState("all"),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [newQuestion, setNewQuestion] = useState(""),
    [newOptions, setNewOptions] = useState(""),
    [newState, setNewState] = useState("draft"),
    [newClosingTime, setNewClosingTime] = useState("");
  const load = useCallback(async () => {
    try {
      const result = await communityAction("admin_inbox");
      setSubmissions(result.submissions as Submission[]);
      setPolls(result.polls as Poll[]);
    } catch (e) {
      setNotice((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function run(op: string, payload: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await communityAction(op, payload);
      setNotice("Saved.");
      await load();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="community-missions">
      <Link href="/admin">← Creator studio</Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE CREATOR’S DESK</p>
          <h1>Community inbox</h1>
          <p>
            Private ideas. Public obsessions. You choose what makes the shelf.
          </p>
        </div>
      </div>
      {notice && (
        <p className="panel" role="status">
          {notice}
        </p>
      )}
      <div className="button-row">
        <label>
          Category{" "}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {["all", "book", "character", "artwork"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Status{" "}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {[
              "all",
              "pending",
              "approved",
              "rejected",
              "archived",
              "planned",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      {submissions
        .filter(
          (s) =>
            (category === "all" || s.category === category) &&
            (status === "all" || s.status === status),
        )
        .map((s) => (
          <article key={s.id} className="panel">
            <p className="eyebrow">
              {s.category} · {s.status} ·{" "}
              {new Date(s.created_at).toLocaleDateString()}
            </p>
            <h3>{s.title}</h3>
            <p>{s.related}</p>
            <p className="submission-notes">{s.notes}</p>
            <small>
              {s.duplicates} matching submissions ·{" "}
              {
                submissions.filter(
                  (x) =>
                    x.book_request_id &&
                    x.book_request_id === s.book_request_id,
                ).length
              }{" "}
              related requests
            </small>
            {!s.merged_into && (
              <>
                <div className="button-row">
                  {["approved", "rejected", "archived", "planned"].map((x) => (
                    <button
                      disabled={busy}
                      key={x}
                      className={`button ${x === "approved" ? "gold" : "outline"}`}
                      onClick={() =>
                        run("admin_moderate", { id: s.id, status: x })
                      }
                    >
                      {x === "approved" ? "Approve for public voting" : x}
                    </button>
                  ))}
                </div>
                <label>
                  Merge into related {s.category} suggestion
                  <select
                    disabled={busy}
                    value=""
                    onChange={(e) => {
                      if (e.target.value)
                        void run("admin_merge", {
                          source: s.id,
                          target: e.target.value,
                        });
                    }}
                  >
                    <option value="">Choose target…</option>
                    {submissions
                      .filter(
                        (t) =>
                          t.id !== s.id &&
                          t.category === s.category &&
                          !t.merged_into,
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} · {t.status}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
          </article>
        ))}
      <section>
        <div className="section-title">
          <h2>Creator polls</h2>
          <span className="muted">Votes and rewards survive edits</span>
        </div>
        <form
          className="panel form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run("admin_poll", {
              title: String(f.get("title")),
              state: String(f.get("state")),
              closes_at: String(f.get("closes_at")),
              options: String(f.get("options"))
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
        >
          <h3>Create a poll</h3>
          <label>
            Start with a preset (optional)
            <select
              disabled={busy}
              value=""
              onChange={(e) => {
                const preset = CREATOR_POLL_PRESETS.find((p) => p.id === e.target.value);
                if (!preset) return;
                setNewQuestion(preset.question);
                setNewOptions(preset.options.join("\n"));
                setNewState("draft");
                setNewClosingTime("");
              }}
            >
              <option value="">Choose a starting point…</option>
              {CREATOR_POLL_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.question}</option>
              ))}
            </select>
          </label>
          <p className="footnote">
            Presets fill the form. Edit anything before creating your poll.
            Loading a preset sets it to draft; choose open when you’re ready.
          </p>
          <label>
            Question
            <input name="title" required maxLength={150} value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} />
          </label>
          <label>
            Options · one per line
            <textarea name="options" required maxLength={2000} rows={6} value={newOptions} onChange={(e) => setNewOptions(e.target.value)} />
          </label>
          <label>
            State
            <select name="state" value={newState} onChange={(e) => setNewState(e.target.value)}>
              <option>draft</option>
              <option>open</option>
            </select>
          </label>
          <label>
            Closing time (optional, UTC)
            <input type="datetime-local" name="closes_at" value={newClosingTime} onChange={(e) => setNewClosingTime(e.target.value)} />
          </label>
          <button disabled={busy} className="button gold">
            Create poll · 25 Ink per collector
          </button>
        </form>
        {polls.map((p) => (
          <form
            key={p.id}
            className="panel form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run("admin_poll", {
                id: p.id,
                title: String(f.get("title")),
                state: String(f.get("state")),
                closes_at: String(f.get("closes_at")),
                option_edits: p.options.map((o) => ({
                  id: o.id,
                  label: String(f.get(o.id)),
                })),
              });
            }}
          >
            <label>
              Question
              <input
                name="title"
                defaultValue={p.title}
                required
                maxLength={150}
              />
            </label>
            <label>
              State
              <select name="state" defaultValue={p.state}>
                {["draft", "open", "closed", "archived"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Closing time (UTC)
              <input
                type="datetime-local"
                name="closes_at"
                defaultValue={
                  p.closes_at
                    ? new Date(p.closes_at).toISOString().slice(0, 16)
                    : ""
                }
              />
            </label>
            {p.options.map((o) => (
              <label key={o.id}>
                Option · {o.votes} votes
                <input
                  name={o.id}
                  defaultValue={o.label}
                  required
                  maxLength={150}
                />
              </label>
            ))}
            <p className="footnote">
              Option IDs remain stable. After votes arrive, label edits should
              clarify wording rather than change the meaning.
            </p>
            <button disabled={busy} className="button gold">
              Save poll
            </button>
          </form>
        ))}
      </section>
    </div>
  );
}

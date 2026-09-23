import { activityLabel, MEET_ACTIVITIES, type PreparedMeetup } from "./meet";

export type MeetupCard = PreparedMeetup & {
  id: string;
  hostName: string;
  going: number;
  conversationId?: string | null;
};

export function MeetBoard({ region, meetups }: { region: string; meetups: MeetupCard[] }) {
  return (
    <div className="np-market">
      <h1>Meet</h1>
      <p className="lead">Get together in {region}. Every meetup is at a public place. You talk in the paper’s chat, and you trade a phone number in person if you want to.</p>
      <div className="actions">
        <a className="primary" href="/meet/new">Host a meetup</a>
        <a className="secondary" href="/chat">Town chat</a>
      </div>
      {meetups.length === 0 ? (
        <section className="empty">
          <h2>No meetups yet.</h2>
          <p>Host a coffee, a walk, or a game. The first meeting is public.</p>
        </section>
      ) : (
        <div className="list">
          {meetups.map(meetup => (
            <a key={meetup.id} className="item" href={`/meet/${encodeURIComponent(meetup.id)}`}>
              <h2>{meetup.activityLabel}</h2>
              <p className="meta">{meetup.placeName} · {new Date(meetup.startsAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {meetup.going} going</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function MeetupDetail({ meetup, joined }: { meetup: MeetupCard; joined: boolean }) {
  return (
    <article className="np-market">
      <p className="meta"><a href="/meet">Meet</a></p>
      <h1>{meetup.activityLabel}</h1>
      <p className="meta">{meetup.placeName} · {meetup.placeDetail}</p>
      <p className="meta">{new Date(meetup.startsAt).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} · Host {meetup.hostName} · {meetup.going} of {meetup.capacity}</p>
      <div className="body">{meetup.notes}</div>
      {!joined && meetup.going < meetup.capacity && (
        <form className="actions" method="post" action={`/api/meet/${encodeURIComponent(meetup.id)}/join`}>
          <button className="primary" type="submit">I’ll be there</button>
        </form>
      )}
      {joined && <p className="meta">You’re going. Use the chat below. Keep phone numbers for when you meet.</p>}
    </article>
  );
}

export function activityChoices() {
  return MEET_ACTIVITIES.map(item => ({ value: item.value, label: activityLabel(item.value) }));
}

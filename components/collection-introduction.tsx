import Link from 'next/link';

export default function CollectionIntroduction() {
  return <section className="collection-introduction" aria-labelledby="collection-introduction-title">
    <p className="eyebrow">A SHELF BEYOND THE STORY</p>
    <h2 id="collection-introduction-title">Collect book characters with Tropeamine Packs</h2>
    <p>Tropeamine Packs is an unofficial, fan-made digital card collection for readers 18 and older. Discover character artwork inspired by romance and fantasy books, open virtual packs, and build a binder of your favorite characters and foil editions.</p>
    <p>Browse the collection by series, track your progress in book and series albums, and use Ink and Shards to grow your collection. Cards and virtual currencies have no cash value.</p>
    <nav aria-label="Explore Tropeamine Packs">
      <Link href="/discover">Browse character cards</Link>
      <Link href="/albums">Explore collection albums</Link>
      <Link href="/odds">Read pack odds</Link>
    </nav>
  </section>;
}

import fragments from './pageFragments.json';

export default function LegacyPage({ id }) {
  const html = fragments[id];
  if (!html) {
    return (
      <div className="module-placeholder">
        <div className="mp-icon">🚧</div>
        This module's UI hasn't been ported yet.
      </div>
    );
  }
  return <div id={`page-${id}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

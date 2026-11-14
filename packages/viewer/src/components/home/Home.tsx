import type React from 'react';
import { useEffect, useRef } from 'react';
import { useViewer } from '../../context/ViewerContext.js';
import { describeRun, FILTER_LABEL } from '../../lib/review-list.js';
import { needsReview } from '../../lib/status.js';
import { ShortcutsHelp } from '../layout/ShortcutsHelp.js';
import { Logo } from '../ui/Logo.js';
import { RunContext } from '../ui/RunContext.js';
import { SearchField } from '../ui/SearchField.js';
import { Segmented, type SegmentOption } from '../ui/Segmented.js';
import { SnapshotCard } from './SnapshotCard.js';

function formatTimestamp(timestamp: string): string | undefined {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Triage: what changed in this run, with a thumbnail for every snapshot. */
export const Home: React.FC = () => {
  const {
    manifest,
    groups,
    filters,
    filter,
    setFilter,
    query,
    setQuery,
    searchTick,
    openSnapshot,
  } = useViewer();
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchTick > 0) search.current?.focus();
  }, [searchTick]);

  const results = manifest.results;
  const pending = results.filter((r) => needsReview(r.status)).length;
  const when = formatTimestamp(manifest.timestamp);

  const filterOptions: SegmentOption<(typeof filters)[number]>[] = filters.map(
    (id) => ({ id, label: FILTER_LABEL[id] }),
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-10 pb-32">
        <header className="h-24 flex items-center justify-between">
          <Logo />
          <ShortcutsHelp />
        </header>

        <section className="pt-8 pb-10 flex flex-col gap-6">
          {pending > 0 ? (
            <h1 className="m-0 text-ui-hero text-ink">
              {pending === 1 ? '1 snapshot' : `${pending} snapshots`}
              <br />
              <span className="text-ink-3">
                {pending === 1 ? 'needs review' : 'need review'}
              </span>
            </h1>
          ) : (
            <h1 className="m-0 text-ui-hero text-ink">
              No visual
              <br />
              <span className="text-ink-3">changes</span>
            </h1>
          )}
          <div className="flex flex-col gap-2">
            <p className="m-0 text-ink-2">
              {pending > 0
                ? describeRun(results)
                : `All ${results.length} ${
                    results.length === 1
                      ? 'snapshot matches its'
                      : 'snapshots match their'
                  } baseline.`}
              {when ? <span className="text-ink-3">{` · ${when}`}</span> : null}
            </p>
            <RunContext />
          </div>
        </section>

        <div className="pb-10 flex flex-wrap items-center justify-between gap-4">
          {filters.length > 1 ? (
            <Segmented
              label="Show"
              value={filter}
              options={filterOptions}
              onChange={setFilter}
            />
          ) : (
            <span />
          )}
          <SearchField
            value={query}
            onChange={setQuery}
            inputRef={search}
            className="w-80"
          />
        </div>

        {groups.length === 0 ? (
          <p className="m-0 text-ink-3">
            {query
              ? `No snapshots match “${query}”.`
              : 'Nothing to show for this filter.'}
          </p>
        ) : (
          <div className="flex flex-col gap-16">
            {groups.map((group) => (
              <section key={group.component} className="flex flex-col gap-6">
                <h2 className="m-0 text-ui-heading text-ink">
                  {group.component}
                </h2>
                <ul className="m-0 p-0 list-none grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-x-8 gap-y-12">
                  {group.items.map((item) => (
                    <SnapshotCard
                      key={item.id}
                      item={item}
                      onOpen={openSnapshot}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

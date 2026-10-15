type Row = Record<string, unknown>;

type Tables = { flagExposures: Row[]; analyticsOutbox: Row[] };

export function withoutCollectionExposure<T extends Tables>(tables: T): T {
  return {
    ...tables,
    flagExposures: tables.flagExposures.filter(({ flag }) => flag !== "collection"),
    analyticsOutbox: tables.analyticsOutbox.filter(({ properties }) => (properties as Row | undefined)?.feature_flag !== "collection"),
  };
}

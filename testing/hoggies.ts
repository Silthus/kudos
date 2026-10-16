type Row = Record<string, unknown>;

type Tables = { flagExposures: Row[]; analyticsOutbox: Row[] };

export function withoutExposureOf<T extends Tables>(flag: string, tables: T): T {
  return {
    ...tables,
    flagExposures: tables.flagExposures.filter((exposure) => exposure.flag !== flag),
    analyticsOutbox: tables.analyticsOutbox.filter(({ properties }) => (properties as Row | undefined)?.feature_flag !== flag),
  };
}

export function withoutCollectionExposure<T extends Tables>(tables: T): T {
  return withoutExposureOf("collection", tables);
}

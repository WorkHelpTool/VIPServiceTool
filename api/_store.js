export const messageReporterMap = new Map();

export const normalizeReporterKey = (reporter) =>
  String(reporter || "")
    .trim()
    .toLowerCase();

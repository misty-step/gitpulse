export type ParsedWindowInput =
  | {
      from: string;
      to: string;
    }
  | {
      error: string;
    };

export function parseWindowInput(from: string, to: string): ParsedWindowInput {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return {
      error: "Please enter valid ISO date values for From and To.",
    };
  }

  if (fromDate.getTime() > toDate.getTime()) {
    return {
      error: '"From" date must be before or equal to "To" date.',
    };
  }

  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  };
}

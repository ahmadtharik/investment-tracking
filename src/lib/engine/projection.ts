export interface ProjectionInput { starting: number; monthlyContribution: number; annualReturn: number }
export interface ProjectionPoint { month: number; value: number; contributed: number }

export function projectSeries(input: ProjectionInput, months: number): ProjectionPoint[] {
  const r = input.annualReturn / 12;
  const count = Math.max(0, Math.floor(months));
  const points: ProjectionPoint[] = [{ month: 0, value: input.starting, contributed: input.starting }];
  let value = input.starting;
  for (let month = 1; month <= count; month += 1) {
    value = value * (1 + r) + input.monthlyContribution;
    points.push({ month, value, contributed: input.starting + input.monthlyContribution * month });
  }
  return points;
}

export function futureValue(input: ProjectionInput, years: number) {
  const months = Math.max(0, Math.floor(years * 12));
  const value = projectSeries(input, months).at(-1)!.value;
  const contributed = input.starting + input.monthlyContribution * months;
  return { value, contributed, growth: value - input.starting };
}

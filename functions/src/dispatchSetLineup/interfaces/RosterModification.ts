export interface RosterModification {
  teamKey: string;
  coverageType: string;
  coveragePeriod: string;
  newPlayerPositions: { [key: string]: string };
}

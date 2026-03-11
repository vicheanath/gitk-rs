import { CLASSIC_GITK_COLORS } from "../../utils/graph/branchColors";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getBranchColor(branchName: string): string {
  const colorIndex = hashString(branchName) % CLASSIC_GITK_COLORS.length;
  return CLASSIC_GITK_COLORS[colorIndex];
}

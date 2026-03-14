import { getBranchColor as getBranchColorByName } from "../../utils/graph/branchColors";

export function getBranchColor(branchName: string): string {
  return getBranchColorByName(branchName);
}
